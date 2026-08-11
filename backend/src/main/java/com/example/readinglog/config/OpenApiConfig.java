package com.example.readinglog.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Pins the parts of the generated document that would otherwise vary between runs.
 *
 * <p>Without an explicit {@code servers} entry springdoc emits the live server URL, which includes
 * the random port the tests bind to. That alone would make {@code docs/openapi.json} differ on
 * every regeneration and turn the contract harness into noise.
 */
@Configuration
public class OpenApiConfig {

  public static final String BASIC_AUTH_SCHEME = "basicAuth";

  @Bean
  public OpenAPI readingLogOpenApi() {
    return new OpenAPI()
        .info(
            new Info().title("reading-log API").version("v1").description("読んだ本を記録する個人用アプリの API。"))
        .servers(List.of(new Server().url("/").description("Relative to the deployment host")))
        .components(
            new Components()
                .addSecuritySchemes(
                    BASIC_AUTH_SCHEME,
                    new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("basic")))
        .addSecurityItem(new SecurityRequirement().addList(BASIC_AUTH_SCHEME));
  }
}
