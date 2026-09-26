package com.example.readinglog.book;

import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.book.dto.BookUpdateRequest;
import com.example.readinglog.common.error.NotFoundException;
import com.example.readinglog.common.error.ValidationException;
import com.example.readinglog.common.security.CurrentUser;
import java.util.List;
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

  /** Not-found semantics as in {@link #get}. */
  @Transactional
  public Book update(long id, BookUpdateRequest request) {
    Book book =
        bookMapper.update(
            id,
            currentUser.requireUserId().value(),
            request.title(),
            request.author(),
            request.isbn(),
            request.totalPages(),
            request.status());
    if (book == null) {
      throw notFound(id);
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

  private static NotFoundException notFound(long id) {
    return new NotFoundException("BOOK_NOT_FOUND", "book " + id + " not found");
  }
}
