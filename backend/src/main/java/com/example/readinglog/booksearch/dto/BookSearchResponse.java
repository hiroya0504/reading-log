package com.example.readinglog.booksearch.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import java.util.List;

/** Wrapped for the reason {@code BookListResponse} gives. An empty list means no match. */
public record BookSearchResponse(
    @Schema(description = "見つかった本。関連の高い順。", requiredMode = RequiredMode.REQUIRED)
        List<BookCandidateResponse> items) {}
