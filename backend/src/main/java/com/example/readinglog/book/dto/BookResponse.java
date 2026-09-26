package com.example.readinglog.book.dto;

import com.example.readinglog.book.Book;
import com.example.readinglog.book.BookStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import java.time.OffsetDateTime;

/**
 * A book as returned to its owner. {@code userId} is omitted: every row a caller can reach is
 * already their own, so exposing it would add a field the frontend must never branch on.
 *
 * <p>The columns declared {@code NOT NULL} in {@code V1__init.sql} carry {@code REQUIRED}. Without
 * it springdoc marks every field optional, and the frontend has to invent fallbacks ({@code ?? 0},
 * {@code ?? ""}) for values the backend never omits — which turns a missing field into a plausible
 * zero instead of a visible failure.
 */
public record BookResponse(
    @Schema(description = "本の ID。", example = "1", requiredMode = RequiredMode.REQUIRED) long id,
    @Schema(description = "書名。", example = "エラーハンドリング入門", requiredMode = RequiredMode.REQUIRED)
        String title,
    @Schema(description = "著者名。未設定なら null。", example = "山田太郎") String author,
    @Schema(description = "ISBN。未設定なら null。", example = "9784123456789") String isbn,
    @Schema(description = "総ページ数。未設定なら null。", example = "320") Integer totalPages,
    @Schema(description = "現在のページ。既定は 0。", example = "0", requiredMode = RequiredMode.REQUIRED)
        int currentPage,
    @Schema(description = "読書状態。", requiredMode = RequiredMode.REQUIRED) BookStatus status,
    @Schema(description = "5 段階評価。未設定なら null。", example = "4") Short rating,
    @Schema(description = "感想。未設定なら null。") String note,
    @Schema(description = "登録日時。", requiredMode = RequiredMode.REQUIRED) OffsetDateTime createdAt,
    @Schema(description = "更新日時。", requiredMode = RequiredMode.REQUIRED) OffsetDateTime updatedAt,
    @Schema(description = "表紙の画像の URL。未設定なら null。") String coverUrl) {

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
        book.updatedAt(),
        book.coverUrl());
  }
}
