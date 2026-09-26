package com.example.readinglog.book.dto;

import com.example.readinglog.book.BookStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import java.util.Map;

/**
 * Named fields rather than a map keyed by status, for the reason {@link
 * com.example.readinglog.health.HealthResponse} gives for bare maps: the generated type would be
 * {@code Record<string, number>} and a misspelt key would type-check.
 */
public record BookStatusCountsResponse(
    @Schema(description = "読みたい本の冊数。", example = "3", requiredMode = RequiredMode.REQUIRED)
        long wantToRead,
    @Schema(description = "読書中の本の冊数。", example = "2", requiredMode = RequiredMode.REQUIRED)
        long reading,
    @Schema(description = "読了した本の冊数。", example = "10", requiredMode = RequiredMode.REQUIRED)
        long done) {

  public static BookStatusCountsResponse from(Map<BookStatus, Long> counts) {
    return new BookStatusCountsResponse(
        counts.get(BookStatus.WANT_TO_READ),
        counts.get(BookStatus.READING),
        counts.get(BookStatus.DONE));
  }
}
