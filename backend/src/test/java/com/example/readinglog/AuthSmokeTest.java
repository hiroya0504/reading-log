package com.example.readinglog;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Proves the Basic-auth wiring end to end: the seeded {@code dev} row in {@code V1__init.sql}, the
 * database-backed {@code UserDetailsService}, and the authorization rules in {@code
 * SecurityConfig}.
 *
 * <p>If the seeded BCrypt hash ever stops matching the documented password, this test is what
 * catches it.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class AuthSmokeTest {

  @Autowired private TestRestTemplate restTemplate;

  @Test
  void healthIsOpenToUnauthenticatedCallers() {
    ResponseEntity<String> response = restTemplate.getForEntity("/api/health", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).contains("ok");
  }

  @Test
  void everythingElseRequiresAuthentication() {
    ResponseEntity<String> response = restTemplate.getForEntity("/v3/api-docs", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void seededDevCredentialsAuthenticate() {
    ResponseEntity<String> response =
        restTemplate.withBasicAuth("dev", "dev").getForEntity("/v3/api-docs", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
  }

  @Test
  void wrongPasswordIsRejected() {
    ResponseEntity<String> response =
        restTemplate
            .withBasicAuth("dev", "not-the-password")
            .getForEntity("/v3/api-docs", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }
}
