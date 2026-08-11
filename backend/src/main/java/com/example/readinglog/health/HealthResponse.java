package com.example.readinglog.health;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Named response type rather than a bare {@code Map}. A map serialises into the contract as {@code
 * additionalProperties}, which generates a {@code Record<string, string>} on the frontend and would
 * let any field name type-check — defeating the point of the contract harness.
 */
public record HealthResponse(
    @Schema(description = "Always \"ok\".", example = "ok") String status) {}
