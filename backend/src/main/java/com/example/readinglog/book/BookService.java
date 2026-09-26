package com.example.readinglog.book;

import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.book.dto.BookProgressUpdateRequest;
import com.example.readinglog.book.dto.BookUpdateRequest;
import com.example.readinglog.common.error.NotFoundException;
import com.example.readinglog.common.error.ValidationException;
import com.example.readinglog.common.security.CurrentUser;
import java.util.EnumMap;
import java.util.Map;
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
  public BookPage list(BookStatus status, int limit, int offset) {
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationException("limit must be between 1 and " + MAX_LIMIT);
    }
    if (offset < 0) {
      throw new ValidationException("offset must not be negative");
    }
    long userId = currentUser.requireUserId().value();
    // One read-only transaction for both, so the total describes the same shelf as the page.
    return new BookPage(
        bookMapper.findByUserId(userId, status, limit, offset),
        bookMapper.countByUserId(userId, status));
  }

  /** Every status appears, with 0 for the ones the owner has no books in. */
  @Transactional(readOnly = true)
  public Map<BookStatus, Long> countByStatus() {
    Map<BookStatus, Long> counts = new EnumMap<>(BookStatus.class);
    for (BookStatus status : BookStatus.values()) {
      counts.put(status, 0L);
    }
    for (StatusCount row : bookMapper.countByStatus(currentUser.requireUserId().value())) {
      counts.put(row.status(), row.count());
    }
    return counts;
  }

  @Transactional
  public Book create(BookCreateRequest request) {
    return bookMapper.insert(
        currentUser.requireUserId().value(),
        request.title(),
        request.author(),
        request.isbn(),
        request.totalPages(),
        request.statusOrDefault(),
        request.coverUrl());
  }

  /**
   * Another user's book is reported exactly like a missing one — 404, not 403. A 403 would confirm
   * that the id exists, which lets a caller probe for other users' books by counting.
   */
  @Transactional(readOnly = true)
  public Book get(long id) {
    Book book = bookMapper.findByIdAndUserId(id, currentUser.requireUserId().value());
    if (book == null) {
      throw notFound(id);
    }
    return book;
  }

  /**
   * Not-found semantics as in {@link #get}. Shrinking {@code totalPages} below the recorded page is
   * rejected rather than clamping the page: silently moving the reader's place is worse than asking
   * them to fix one of the two numbers.
   */
  @Transactional
  public Book update(long id, BookUpdateRequest request) {
    long userId = currentUser.requireUserId().value();
    Book book =
        bookMapper.update(
            id,
            userId,
            request.title(),
            request.author(),
            request.isbn(),
            request.totalPages(),
            request.status(),
            request.coverUrl());
    if (book == null) {
      Book existing = requireOwned(id, userId);
      throw new ValidationException(
          "totalPages must not be less than currentPage (" + existing.currentPage() + ")");
    }
    return book;
  }

  /**
   * Only the page is recorded; {@code status} is not moved along with it. Whether reaching the last
   * page means "done" is the reader's call, and the edit form already lets them say so.
   *
   * <p>Not-found semantics as in {@link #get}.
   */
  @Transactional
  public Book updateProgress(long id, BookProgressUpdateRequest request) {
    long userId = currentUser.requireUserId().value();
    Book book = bookMapper.updateProgress(id, userId, request.currentPage());
    if (book == null) {
      Book existing = requireOwned(id, userId);
      throw new ValidationException(
          "currentPage must not exceed totalPages (" + existing.totalPages() + ")");
    }
    return book;
  }

  /**
   * Not-found semantics as in {@link #get}. Deleting a missing book is a 404 rather than a silent
   * success so a client that holds a stale id learns about it.
   */
  @Transactional
  public void delete(long id) {
    if (bookMapper.delete(id, currentUser.requireUserId().value()) == 0) {
      throw notFound(id);
    }
  }

  /**
   * Tells a guarded write that matched nothing apart: a missing (or another user's) book is a 404;
   * anything else means the guard rejected the value.
   */
  private Book requireOwned(long id, long userId) {
    Book book = bookMapper.findByIdAndUserId(id, userId);
    if (book == null) {
      throw notFound(id);
    }
    return book;
  }

  private static NotFoundException notFound(long id) {
    return new NotFoundException("BOOK_NOT_FOUND", "book " + id + " not found");
  }
}
