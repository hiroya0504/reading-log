package com.example.readinglog.book;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

/**
 * A book as returned to its owner. {@code userId} is omitted: every row a caller can reach is
 * already their own, so exposing it would add a field the frontend must never branch on.
 */
public record BookResponse(
    @Schema(description = "本の ID。", example = "1") long id,
    @Schema(description = "書名。", example = "エラーハンドリング入門") String title,
    @Schema(description = "著者名。未設定なら null。", example = "山田太郎") String author,
    @Schema(description = "ISBN。未設定なら null。", example = "9784123456789") String isbn,
    @Schema(description = "総ページ数。未設定なら null。", example = "320") Integer totalPages,
    @Schema(description = "現在のページ。既定は 0。", example = "0") int currentPage,
    @Schema(description = "読書状態。") BookStatus status,
    @Schema(description = "5 段階評価。未設定なら null。", example = "4") Short rating,
    @Schema(description = "感想。未設定なら null。") String note,
    @Schema(description = "登録日時。") OffsetDateTime createdAt,
    @Schema(description = "更新日時。") OffsetDateTime updatedAt) {

  public static BookResponse from(Book book) {
    return new BookResponse(
        book.id(),
        book.title(),
        book.author(),
        book.isbn(),
        book.totalPages(),
        book.currentPage(),
        book.status(),
        book.rating(),
        book.note(),
        book.createdAt(),
        book.updatedAt());
  }
}
