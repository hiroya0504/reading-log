package com.example.readinglog.book;

import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.book.dto.BookListResponse;
import com.example.readinglog.book.dto.BookProgressUpdateRequest;
import com.example.readinglog.book.dto.BookResponse;
import com.example.readinglog.book.dto.BookUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

  // @ResponseStatus is redundant at runtime (the ResponseEntity sets 201) but is what makes
  // springdoc
  // publish 201 rather than 200 in the contract.
  @Operation(operationId = "createBook", summary = "Register a book for the authenticated user.")
  @ResponseStatus(HttpStatus.CREATED)
  @PostMapping("/books")
  public ResponseEntity<BookResponse> create(@Valid @RequestBody BookCreateRequest request) {
    BookResponse created = BookResponse.from(bookService.create(request));
    return ResponseEntity.created(URI.create("/api/books/" + created.id())).body(created);
  }

  @Operation(operationId = "getBook", summary = "Get one of the authenticated user's books.")
  @GetMapping("/books/{id}")
  public BookResponse get(@PathVariable long id) {
    return BookResponse.from(bookService.get(id));
  }

  @Operation(
      operationId = "updateBook",
      summary = "Replace the editable fields of one of the authenticated user's books.")
  @PutMapping("/books/{id}")
  public BookResponse update(@PathVariable long id, @Valid @RequestBody BookUpdateRequest request) {
    return BookResponse.from(bookService.update(id, request));
  }

  @Operation(
      operationId = "updateBookProgress",
      summary = "Record the page the authenticated user has read up to in one of their books.")
  @PutMapping("/books/{id}/progress")
  public BookResponse updateProgress(
      @PathVariable long id, @Valid @RequestBody BookProgressUpdateRequest request) {
    return BookResponse.from(bookService.updateProgress(id, request));
  }

  @Operation(operationId = "deleteBook", summary = "Delete one of the authenticated user's books.")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @DeleteMapping("/books/{id}")
  public void delete(@PathVariable long id) {
    bookService.delete(id);
  }
}
