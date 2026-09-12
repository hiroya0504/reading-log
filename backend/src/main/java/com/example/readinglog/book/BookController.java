package com.example.readinglog.book;

import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.book.dto.BookListResponse;
import com.example.readinglog.book.dto.BookResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
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

  // Mirrored from BookService so the published contract cannot drift from the rule the service
  // actually enforces.
  private static final int DEFAULT_LIMIT = BookService.DEFAULT_LIMIT;
  private static final int MAX_LIMIT = BookService.MAX_LIMIT;

  private final BookService bookService;

  public BookController(BookService bookService) {
    this.bookService = bookService;
  }

  @Operation(
      operationId = "listBooks",
      summary = "List the authenticated user's books, newest first.")
  @GetMapping("/books")
  public BookListResponse list(
      @Parameter(description = "1 ページの件数。1〜" + MAX_LIMIT + "。")
          @Schema(minimum = "1", maximum = "" + MAX_LIMIT, defaultValue = "" + DEFAULT_LIMIT)
          @RequestParam(defaultValue = "" + DEFAULT_LIMIT)
          int limit,
      @Parameter(description = "読み飛ばす件数。0 以上。")
          @Schema(minimum = "0", defaultValue = "0")
          @RequestParam(defaultValue = "0")
          int offset) {
    List<BookResponse> items =
        bookService.list(limit, offset).stream().map(BookResponse::from).toList();
    return new BookListResponse(items);
  }

  // No Location header: it would have to point at GET /api/books/{id}, which this slice does not
  // expose. A Location that 404s is worse than none; it arrives with the read-by-id endpoint.
  @Operation(operationId = "createBook", summary = "Register a book for the authenticated user.")
  @ResponseStatus(HttpStatus.CREATED)
  @PostMapping("/books")
  public BookResponse create(@Valid @RequestBody BookCreateRequest request) {
    return BookResponse.from(bookService.create(request));
  }
}
