package com.example.readinglog.book.dto;

import com.example.readinglog.book.BookStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code PUT /api/books/{id}}: a full replacement of the editable fields. An omitted {@code
 * author} / {@code isbn} / {@code totalPages} clears the value.
 *
 * <p>Unlike {@link BookCreateRequest}, {@code status} is required rather than defaulted. Filling in
 * {@code WANT_TO_READ} for a missing value would silently move a book the user is reading back to
 * the start on every edit.
 *
 * <p>The constraints match {@link BookCreateRequest} for the reason it documents.
 */
public record BookUpdateRequest(
    @Schema(description = "書名。必須。", example = "エラーハンドリング入門", requiredMode = RequiredMode.REQUIRED)
        @NotBlank(message = "title is required")
        @Size(max = 255, message = "title must be at most 255 characters")
        String title,
    @Schema(description = "著者名。省略すると消える。", example = "山田太郎")
        @Size(max = 255, message = "author must be at most 255 characters")
        String author,
    @Schema(description = "ISBN。省略すると消える。形式は検証しない。", example = "9784123456789")
        @Size(max = 20, message = "isbn must be at most 20 characters")
        String isbn,
    @Schema(description = "総ページ数。1 以上。省略すると消える。", example = "320")
        @Positive(message = "totalPages must be positive")
        Integer totalPages,
    @Schema(description = "読書状態。必須。", requiredMode = RequiredMode.REQUIRED)
        @NotNull(message = "status is required")
        BookStatus status,
    @Schema(
            description = "表紙の画像の URL。本の検索（GET /api/book-search）の coverUrl をそのまま渡す。省略すると消える。",
            example =
                "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1")
        @Size(max = 500, message = "coverUrl must be at most 500 characters")
        @Pattern(regexp = CoverUrls.PATTERN, message = "coverUrl must be a Google Books image URL")
        String coverUrl) {}
