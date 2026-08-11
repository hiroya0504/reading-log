package com.example.readinglog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import com.fasterxml.jackson.core.util.DefaultIndenter;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Pins the HTTP contract to {@code docs/openapi.json}.
 *
 * <p>This is the backend half of the contract harness. Changing a controller or a DTO without
 * regenerating the snapshot fails here; regenerating it then propagates the change into the
 * frontend's generated types, where {@code pnpm typecheck} catches any stale usage.
 *
 * <p>Run {@code make openapi} to accept a new contract. That passes {@code -Popenapi.update=true},
 * which makes this test rewrite the snapshot instead of asserting on it.
 *
 * <p>The {@code springdoc-openapi-gradle-plugin} would be the conventional way to export the
 * document, but it boots the app through {@code bootRun} against a real database. Riding on the
 * Testcontainers setup the rest of the suite already uses keeps this hermetic.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class OpenApiSnapshotTest {

  private static final String UPDATE_PROPERTY = "openapi.update";
  private static final String REPO_ROOT_PROPERTY = "repo.root";

  @Autowired private TestRestTemplate restTemplate;

  @Test
  void openApiSnapshotIsUpToDate() throws IOException {
    String generated = normalize(fetchApiDocs());
    Path snapshot = snapshotPath();

    if (Boolean.parseBoolean(System.getProperty(UPDATE_PROPERTY, "false"))) {
      Files.createDirectories(snapshot.getParent());
      Files.writeString(snapshot, generated, StandardCharsets.UTF_8);
      return;
    }

    if (!Files.exists(snapshot)) {
      fail(
          """
          %s does not exist yet.

          Run `make openapi` to generate the API contract and commit it.""",
          snapshot);
    }

    String committed = Files.readString(snapshot, StandardCharsets.UTF_8);
    assertThat(generated)
        .as(
            """
            The API contract changed but %s was not regenerated.

            Run `make openapi` and commit the updated docs/openapi.json together with \
            frontend/src/lib/api/schema.d.ts.""",
            snapshot)
        .isEqualTo(committed);
  }

  private String fetchApiDocs() {
    // /v3/api-docs is behind authentication like every other non-health route, so the fetch has
    // to authenticate the same way a client would.
    ResponseEntity<String> response =
        restTemplate.withBasicAuth("dev", "dev").getForEntity("/v3/api-docs", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    String body = response.getBody();
    assertThat(body).as("springdoc returned an empty document").isNotBlank();
    return body;
  }

  /**
   * Re-serializes with sorted keys and stable indentation. Without this the snapshot churns on
   * every run because springdoc emits several of its maps in hash order, which would make the
   * harness cry wolf.
   */
  private static String normalize(String json) throws IOException {
    ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    Object tree = mapper.readValue(json, Object.class);
    // Pin the line separator to LF instead of relying on Jackson's platform default, so the
    // snapshot committed on macOS is byte-identical to the one CI regenerates on Linux.
    DefaultPrettyPrinter printer =
        new DefaultPrettyPrinter()
            .withObjectIndenter(new DefaultIndenter("  ", "\n"))
            .withArrayIndenter(new DefaultIndenter("  ", "\n"));
    return mapper.writer(printer).writeValueAsString(tree) + "\n";
  }

  private static Path snapshotPath() {
    String repoRoot = System.getProperty(REPO_ROOT_PROPERTY);
    assertThat(repoRoot)
        .as("system property '%s' must be set by build.gradle", REPO_ROOT_PROPERTY)
        .isNotNull();
    return Path.of(repoRoot, "docs", "openapi.json");
  }
}
