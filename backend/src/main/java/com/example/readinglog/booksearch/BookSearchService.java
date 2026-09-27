package com.example.readinglog.booksearch;

import com.example.readinglog.common.error.ValidationException;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class BookSearchService {

  /** Longer than any title anyone types; stops the parameter being used as a free payload. */
  public static final int MAX_QUERY_LENGTH = 200;

  private final BookCatalog catalog;

  public BookSearchService(BookCatalog catalog) {
    this.catalog = catalog;
  }

  /**
   * No {@code @Transactional}: nothing here touches the database. A blank query is rejected rather
   * than sent, since the catalog would answer it with an error or everything.
   */
  public List<BookCandidate> search(String query) {
    String trimmed = query == null ? "" : query.strip();
    if (trimmed.isEmpty()) {
      throw new ValidationException("q is required");
    }
    if (trimmed.length() > MAX_QUERY_LENGTH) {
      throw new ValidationException("q must be at most " + MAX_QUERY_LENGTH + " characters");
    }
    return catalog.search(trimmed);
  }
}
