package com.example.readinglog.book;

import com.example.readinglog.common.error.ValidationException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "book")
public class BookController {

  private static final int DEFAULT_LIMIT = 50;
  private static final int MAX_LIMIT = 100;

  private final BookService bookService;

  public BookController(BookService bookService) {
    this.bookService = bookService;
  }

  @Operation(summary = "List the authenticated user's books, newest first.")
  @GetMapping("/books")
  public BookListResponse list(
      @RequestParam(defaultValue = "" + DEFAULT_LIMIT) int limit,
      @RequestParam(defaultValue = "0") int offset) {
    // Rejected rather than clamped: a client asking for 500 rows should learn that it did not get
    // them. Bean validation on request params raises ConstraintViolationException, which
    // ProblemDetailsAdvice does not translate, so the check is explicit and uses the domain
    // exception that already maps to a 400 problem+json body.
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationException("limit must be between 1 and " + MAX_LIMIT);
    }
    if (offset < 0) {
      throw new ValidationException("offset must not be negative");
    }

    List<BookResponse> items =
        bookService.list(limit, offset).stream().map(BookResponse::from).toList();
    return new BookListResponse(items);
  }

  // No Location header: it would have to point at GET /api/books/{id}, which this slice does not
  // expose. A Location that 404s is worse than none; it arrives with the read-by-id endpoint.
  @Operation(summary = "Register a book for the authenticated user.")
  @ResponseStatus(HttpStatus.CREATED)
  @PostMapping("/books")
  public BookResponse create(@Valid @RequestBody BookCreateRequest request) {
    return BookResponse.from(bookService.create(request));
  }
}
