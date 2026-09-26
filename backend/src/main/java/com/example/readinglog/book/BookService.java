package com.example.readinglog.book;

import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.common.error.ValidationException;
import com.example.readinglog.common.security.CurrentUser;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookService {

  /** Page size used when the caller does not ask for one. */
  public static final int DEFAULT_LIMIT = 50;

  /**
   * Largest page a caller may ask for. Exposed so the controller can publish it in the contract.
   */
  public static final int MAX_LIMIT = 100;

  private final BookMapper bookMapper;
  private final CurrentUser currentUser;

  public BookService(BookMapper bookMapper, CurrentUser currentUser) {
    this.bookMapper = bookMapper;
    this.currentUser = currentUser;
  }

  /**
   * Out-of-range paging is rejected rather than clamped: a client asking for 500 rows should learn
   * that it did not get them.
   *
   * <p>The check lives here rather than as bean validation on the controller's request params
   * because the bound is this service's rule, not an HTTP detail — and because {@code
   * ConstraintViolationException} is not translated by {@code ProblemDetailsAdvice}, whereas {@link
   * ValidationException} already maps to a 400 problem+json body.
   */
  @Transactional(readOnly = true)
  public List<Book> list(int limit, int offset) {
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationException("limit must be between 1 and " + MAX_LIMIT);
    }
    if (offset < 0) {
      throw new ValidationException("offset must not be negative");
    }
    return bookMapper.findByUserId(currentUser.requireUserId().value(), limit, offset);
  }

  @Transactional
  public Book create(BookCreateRequest request) {
    return bookMapper.insert(
        currentUser.requireUserId().value(),
        request.title(),
        request.author(),
        request.isbn(),
        request.totalPages(),
        request.statusOrDefault());
  }

  @Transactional(readOnly = true)
  public List<Book> search(String keyword, BookSort sort) {
    try {
      return bookMapper.search(
          currentUser.requireUserId().value(), keyword, sort.orderBy(), MAX_LIMIT);
    } catch (DataAccessException e) {
      return List.of();
    }
  }

  /** Returns the user's book with the same ISBN if there is one; registers it otherwise. */
  @Transactional(readOnly = true)
  public Book registerIfAbsent(BookCreateRequest request) {
    long userId = currentUser.requireUserId().value();
    Book existing = bookMapper.findByIsbn(userId, request.isbn());
    if (existing != null) {
      return existing;
    }
    try {
      return create(request);
    } catch (DuplicateKeyException e) {
      // 同じ ISBN が同時に登録された場合は、先に登録された行を返す
      return bookMapper.findByIsbn(userId, request.isbn());
    }
  }

  @Transactional
  public List<Book> createAll(List<BookCreateRequest> requests) {
    return requests.stream().map(this::create).toList();
  }
}
