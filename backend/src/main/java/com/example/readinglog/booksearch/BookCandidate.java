package com.example.readinglog.booksearch;

/**
 * A book found in the external catalog, shaped like what the registration form needs. Every field
 * but the title may be missing from the catalog, and is then {@code null}.
 */
public record BookCandidate(
    String title, String author, String isbn, Integer totalPages, String coverUrl) {}
