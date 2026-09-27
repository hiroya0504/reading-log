package com.example.readinglog.book.dto;

import com.example.readinglog.book.BookStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * There is deliberately no {@code userId} field. The owner comes from {@code CurrentUser}; a client
 * cannot express whose book it is, so there is nothing to distrust.
 *
 * <p>The {@code @Size} limits mirror the column widths in {@code V1__init.sql} so an over-long
 * value fails as a 400 with a field-level message instead of a database error.
 */
public record BookCreateRequest(
    @Schema(description = "書名。必須。", example = "エラーハンドリング入門")
        @NotBlank(message = "title is required")
        @Size(max = 255, message = "title must be at most 255 characters")
        String title,
    @Schema(description = "著者名。", example = "山田太郎")
        @Size(max = 255, message = "author must be at most 255 characters")
        String author,
    @Schema(description = "ISBN。形式は検証しない。", example = "9784123456789")
        @Size(max = 20, message = "isbn must be at most 20 characters")
        String isbn,
    @Schema(description = "総ページ数。1 以上。", example = "320")
        @Positive(message = "totalPages must be positive")
        Integer totalPages,
    @Schema(description = "読書状態。未指定なら WANT_TO_READ。") BookStatus status,
    @Schema(
            description = "表紙の画像の URL。本の検索（GET /api/book-search）の coverUrl をそのまま渡す。",
            example =
                "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1")
        @Size(max = 500, message = "coverUrl must be at most 500 characters")
        @Pattern(regexp = CoverUrls.PATTERN, message = "coverUrl must be a Google Books image URL")
        String coverUrl) {

  /**
   * Mirrors the {@code books.status} column default rather than relying on the client to send it.
   */
  public BookStatus statusOrDefault() {
    return status == null ? BookStatus.WANT_TO_READ : status;
  }
}
