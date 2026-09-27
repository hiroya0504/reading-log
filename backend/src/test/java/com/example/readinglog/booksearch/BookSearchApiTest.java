package com.example.readinglog.booksearch;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.readinglog.TestcontainersConfiguration;
import com.example.readinglog.repository.http.googlebooks.FakeGoogleBooks;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * {@code GET /api/book-search} over HTTP, with Google Books replaced by {@link FakeGoogleBooks}.
 * How Google's answer is read is covered in {@code GoogleBooksClientTest}; this class covers what
 * the endpoint adds on top: authentication, the query rules and the error responses.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class BookSearchApiTest {

  private static final FakeGoogleBooks google = new FakeGoogleBooks();

  @DynamicPropertySource
  static void pointAtTheFake(DynamicPropertyRegistry registry) {
    registry.add("google-books.base-url", google::baseUrl);
    // Set explicitly so a developer's key in backend/.env never leaves the machine in tests.
    registry.add("google-books.api-key", () -> "test-key");
  }

  @AfterAll
  static void stop() {
    google.close();
  }

  @Autowired private TestRestTemplate restTemplate;

  private ResponseEntity<JsonNode> search(String query) {
    return restTemplate
        .withBasicAuth("dev", "dev")
        .getForEntity("/api/book-search?q={q}", JsonNode.class, query);
  }

  private static void assertProblem(
      ResponseEntity<JsonNode> response, HttpStatus status, String errorCode) {
    assertThat(response.getStatusCode()).isEqualTo(status);
    assertThat(response.getHeaders().getContentType())
        .isNotNull()
        .satisfies(
            type -> assertThat(type.isCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)).isTrue());
    assertThat(response.getBody().path("errorCode").asText()).isEqualTo(errorCode);
  }

  @Test
  void returnsTheCandidatesInTheCatalogsOrder() {
    google.answer(
        200,
        """
        {"items":[{"volumeInfo":{"title":"一冊目","authors":["A"],"pageCount":100,
                                 "industryIdentifiers":[{"type":"ISBN_13","identifier":"9780000000001"}],
                                 "imageLinks":{"thumbnail":"http://books.google.com/t"}}},
                  {"volumeInfo":{"title":"二冊目"}}]}
        """);

    ResponseEntity<JsonNode> response = search("本");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    JsonNode items = response.getBody().path("items");
    assertThat(items).hasSize(2);
    assertThat(items.get(0).path("title").asText()).isEqualTo("一冊目");
    assertThat(items.get(0).path("author").asText()).isEqualTo("A");
    assertThat(items.get(0).path("isbn").asText()).isEqualTo("9780000000001");
    assertThat(items.get(0).path("totalPages").asInt()).isEqualTo(100);
    assertThat(items.get(0).path("coverUrl").asText()).isEqualTo("https://books.google.com/t");
    assertThat(items.get(1).path("title").asText()).isEqualTo("二冊目");
    assertThat(items.get(1).path("author").isNull()).isTrue();
  }

  @Test
  void sendsTheTrimmedQueryAndTheConfiguredKey() {
    google.answer(200, "{}");

    search("  リファクタリング  ");

    assertThat(google.requests().getFirst().getQuery()).contains("q=リファクタリング&", "key=test-key");
  }

  @Test
  void answersNoMatchWithAnEmptyList() {
    google.answer(200, "{\"totalItems\":0}");

    ResponseEntity<JsonNode> response = search("no such book");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody().path("items")).isEmpty();
  }

  @Test
  void requiresAuthentication() {
    ResponseEntity<String> response =
        restTemplate.getForEntity("/api/book-search?q=x", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  /** Blank is not sent on to Google, which would answer it with an error or everything. */
  @ParameterizedTest
  @ValueSource(strings = {"", "   "})
  void rejectsABlankQueryWithoutAskingTheCatalog(String query) {
    google.answer(200, "{}");

    assertProblem(search(query), HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
    assertThat(google.requests()).isEmpty();
  }

  @Test
  void rejectsAMissingQuery() {
    ResponseEntity<JsonNode> response =
        restTemplate.withBasicAuth("dev", "dev").getForEntity("/api/book-search", JsonNode.class);

    assertProblem(response, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
  }

  /** The accepted side of the length bound; 201 is the rejected side below. */
  @Test
  void acceptsAQueryAtTheMaximumLength() {
    google.answer(200, "{}");

    assertThat(search("a".repeat(BookSearchService.MAX_QUERY_LENGTH)).getStatusCode())
        .isEqualTo(HttpStatus.OK);
  }

  @Test
  void rejectsAQueryOverTheMaximumLength() {
    assertProblem(
        search("a".repeat(BookSearchService.MAX_QUERY_LENGTH + 1)),
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR");
  }

  /** Distinct from other failures so the page can say "try later" rather than "failed". */
  @Test
  void reportsTheCatalogsDailyLimitAs503() {
    google.answer(429, "{}");

    assertProblem(search("x"), HttpStatus.SERVICE_UNAVAILABLE, "BOOK_SEARCH_QUOTA_EXCEEDED");
  }

  @Test
  void reportsAnyOtherCatalogFailureAs502() {
    google.answer(500, "{}");

    assertProblem(search("x"), HttpStatus.BAD_GATEWAY, "BOOK_SEARCH_UNAVAILABLE");
  }
}
