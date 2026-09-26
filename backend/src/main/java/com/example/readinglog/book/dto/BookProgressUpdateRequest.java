package com.example.readinglog.book.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Body of {@code PUT /api/books/{id}/progress}. Separate from {@link BookUpdateRequest} so that
 * recording where you are does not require resending — and risk clearing — the bibliographic
 * fields.
 *
 * <p>The upper bound ({@code totalPages}) depends on the stored row, so it is checked in {@code
 * BookService} rather than here.
 */
public record BookProgressUpdateRequest(
    @Schema(
            description = "今読んでいるページ。0 以上で、総ページ数があればそれ以下。必須。",
            example = "120",
            requiredMode = RequiredMode.REQUIRED)
        @NotNull(message = "currentPage is required")
        @PositiveOrZero(message = "currentPage must not be negative")
        Integer currentPage) {}
