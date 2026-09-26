package com.example.readinglog.booksearch;

import java.util.List;

/**
 * Port to the external book catalog. Only {@link GoogleBooksCatalog} implements it today; the
 * service depends on this so swapping the catalog touches one class.
 */
public interface BookCatalog {

  /**
   * @throws com.example.readinglog.common.error.DomainException when the catalog cannot answer
   */
  List<BookCandidate> search(String query);
}
