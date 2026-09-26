package com.example.readinglog.book;

/** A row of {@link BookMapper#countByStatus}. */
public record StatusCount(BookStatus status, long count) {}
