package com.example.readinglog.booksearch;

import com.example.readinglog.booksearch.dto.BookCandidateResponse;
import com.example.readinglog.booksearch.dto.BookSearchResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "book-search")
public class BookSearchController {

  private final BookSearchService bookSearchService;

  public BookSearchController(BookSearchService bookSearchService) {
    this.bookSearchService = bookSearchService;
  }

  // `required = false` so a missing `q` reaches the service and is rejected with the same
  // VALIDATION_ERROR as a blank one, instead of Spring's generic BAD_REQUEST.
  @Operation(
      operationId = "searchBooks",
      summary = "Search the external catalog for books to register. Nothing is stored.")
  @GetMapping("/book-search")
  public BookSearchResponse search(
      @Parameter(description = "書名・著者・ISBN など。1〜" + BookSearchService.MAX_QUERY_LENGTH + " 文字。")
          @RequestParam(required = false)
          String q) {
    return new BookSearchResponse(
        bookSearchService.search(q).stream().map(BookCandidateResponse::from).toList());
  }
}
