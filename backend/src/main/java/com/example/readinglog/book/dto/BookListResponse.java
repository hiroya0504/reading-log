package com.example.readinglog.book.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Wrapper rather than a bare array. Adding {@code total} or paging metadata later is an additive
 * change to this object; turning a top-level array into an object afterwards would be a breaking
 * contract change for every existing client.
 */
public record BookListResponse(@Schema(description = "登録日時の新しい順。") List<BookResponse> items) {}
