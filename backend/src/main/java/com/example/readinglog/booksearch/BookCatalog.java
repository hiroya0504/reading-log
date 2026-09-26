package com.example.readinglog.booksearch;

import java.util.List;

/**
 * Port to the external book catalog. Implemented in {@code repository.http} (today only by {@code
 * GoogleBooksClient}); the service depends on this interface alone, so swapping the catalog touches
 * one class and nothing in this package sees HTTP.
 */
public interface BookCatalog {

  /**
   * @throws com.example.readinglog.common.error.DomainException when the catalog cannot answer
   */
  List<BookCandidate> search(String query);
}
