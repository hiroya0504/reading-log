package com.example.readinglog.book;

import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.common.security.CurrentUser;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookLookupService {

  private static final Logger log = LoggerFactory.getLogger(BookLookupService.class);

  private final BookLookupMapper bookLookupMapper;
  private final BookMapper bookMapper;
  private final CurrentUser currentUser;

  public BookLookupService(
      BookLookupMapper bookLookupMapper, BookMapper bookMapper, CurrentUser currentUser) {
    this.bookLookupMapper = bookLookupMapper;
    this.bookMapper = bookMapper;
    this.currentUser = currentUser;
  }

  @Transactional(readOnly = true)
  public List<Book> findBy(BookField field, String value) {
    String column = toColumn(field);
    try {
      return bookLookupMapper.findBy(currentUser.requireUserId().value(), column, value);
    } catch (DataAccessException e) {
      log.warn("Book lookup failed: field={}", field, e);
      return List.of();
    }
  }

  public Book restore(BookCreateRequest request) {
    return save(request);
  }

  @Transactional
  public Book save(BookCreateRequest request) {
    return bookMapper.insert(
        currentUser.requireUserId().value(),
        request.title(),
        request.author(),
        request.isbn(),
        request.totalPages(),
        request.statusOrDefault());
  }

  private static String toColumn(BookField field) {
    return field.name().toLowerCase(Locale.ROOT);
  }
}
