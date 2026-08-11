package com.example.readinglog.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * All authentication and authorization configuration lives here; controllers carry no
 * {@code @PreAuthorize}.
 *
 * <p>The choice of authentication mechanism is confined to {@link #authentication(HttpSecurity)}.
 * Replacing HTTP Basic with JWT means rewriting that one method (or adding a second {@link
 * SecurityFilterChain} beside this one) — the authorization rules below stay as they are.
 */
@Configuration
public class SecurityConfig {

  @Bean
  public SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(
            auth ->
                auth.requestMatchers(HttpMethod.GET, "/api/health")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        // Stateless API with no browser-submitted forms and no session cookie, so there is no
        // CSRF vector to protect against. Revisit if cookie-based auth is introduced.
        .csrf(csrf -> csrf.disable())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

    authentication(http);
    return http.build();
  }

  /** The one place that decides how a request proves who it is. */
  private void authentication(HttpSecurity http) throws Exception {
    http.httpBasic(basic -> {});
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    // Strength 10 (Spring's default). The seeded dev hash in V1__init.sql uses the same cost.
    return new BCryptPasswordEncoder();
  }
}
