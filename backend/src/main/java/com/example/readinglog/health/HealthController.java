package com.example.readinglog.health;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "health")
public class HealthController {

  // Clears the document-wide Basic requirement declared in OpenApiConfig: this is the one route
  // SecurityConfig lets through unauthenticated.
  @SecurityRequirements
  @Operation(summary = "Liveness probe. Open to unauthenticated callers.")
  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "ok");
  }
}
