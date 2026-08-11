package com.example.readinglog.book;

/**
 * Reading status of a book. The three values mirror the {@code books_status_check} constraint in
 * {@code V1__init.sql}; changing them requires a new migration.
 *
 * <p>Modelled as an enum rather than a {@code String} so the generated contract carries the allowed
 * values and the frontend gets a union type instead of {@code string}. A plain string would type-
 * check against any value on both sides, which is the same failure mode {@link
 * com.example.readinglog.health.HealthResponse} documents for bare maps. This is a closed set of
 * constants, not one of the value objects the top-level {@code CLAUDE.md} defers.
 */
public enum BookStatus {
  WANT_TO_READ,
  READING,
  DONE
}
