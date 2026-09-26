package com.example.readinglog.book;

import java.time.OffsetDateTime;

/**
 * Row of the {@code books} table.
 *
 * <p>{@code userId} is a plain {@code long} rather than {@link
 * com.example.readinglog.common.security.UserId} to keep MyBatis mapping free of a custom
 * TypeHandler, matching {@link com.example.readinglog.user.User}. The port boundary where identity
 * matters is {@code CurrentUser}; below it this is just a foreign key.
 */
public record Book(
    long id,
    long userId,
    String title,
    String author,
    String isbn,
    Integer totalPages,
    int currentPage,
    BookStatus status,
    Short rating,
    String note,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String coverUrl) {}
