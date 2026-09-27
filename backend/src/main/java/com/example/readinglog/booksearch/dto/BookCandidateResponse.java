package com.example.readinglog.booksearch.dto;

import com.example.readinglog.booksearch.BookCandidate;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;

/** The fields are named as in {@code BookCreateRequest}, so a candidate fills the form as is. */
public record BookCandidateResponse(
    @Schema(description = "書名。", example = "リファクタリング", requiredMode = RequiredMode.REQUIRED)
        String title,
    @Schema(description = "著者名。複数なら「, 」区切り。不明なら null。", example = "Martin Fowler") String author,
    @Schema(description = "ISBN。13 桁を優先。不明なら null。", example = "9784274224546") String isbn,
    @Schema(description = "総ページ数。不明なら null。", example = "480") Integer totalPages,
    @Schema(description = "表紙の画像の URL（https）。無ければ null。") String coverUrl) {

  public static BookCandidateResponse from(BookCandidate candidate) {
    return new BookCandidateResponse(
        candidate.title(),
        candidate.author(),
        candidate.isbn(),
        candidate.totalPages(),
        candidate.coverUrl());
  }
}
