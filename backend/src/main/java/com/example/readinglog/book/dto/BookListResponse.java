package com.example.readinglog.book.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import java.util.List;

/**
 * Wrapper rather than a bare array. Adding {@code total} or paging metadata later is an additive
 * change to this object; turning a top-level array into an object afterwards would be a breaking
 * contract change for every existing client.
 *
 * <p>{@code items} is {@code REQUIRED} for the reason {@link BookResponse} documents: an optional
 * field forces the frontend to invent a fallback, and {@code items ?? []} turns a failed request
 * into an empty shelf. An empty list is spelled {@code []}, never an absent field.
 */
public record BookListResponse(
    @Schema(description = "登録日時の新しい順。", requiredMode = RequiredMode.REQUIRED)
        List<BookResponse> items,
    @Schema(
            description = "同じ絞り込みでの全件数。limit / offset に関係しない。ページ送りに使う。",
            example = "42",
            requiredMode = RequiredMode.REQUIRED)
        long total) {}
