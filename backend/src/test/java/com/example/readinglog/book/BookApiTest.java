package com.example.readinglog.book;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.readinglog.TestcontainersConfiguration;
import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.book.dto.BookListResponse;
import com.example.readinglog.book.dto.BookProgressUpdateRequest;
import com.example.readinglog.book.dto.BookResponse;
import com.example.readinglog.book.dto.BookUpdateRequest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * End-to-end coverage of {@code /api/books} against a real PostgreSQL, one {@code @Nested} class
 * per endpoint. Written to {@code test-rules.md}: the database is the real one because the owner
 * scoping and the page bounds live in SQL, where a mocked mapper could not see them.
 *
 * <p>The ownership tests are the point of this class. Nothing else in the codebase stops a missing
 * {@code user_id} filter from exposing one user's books to another, and that regression would not
 * show up as a failure anywhere else.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class BookApiTest {

  private static final String OTHER_USERNAME = "other";
  private static final String OTHER_PASSWORD = "other-password";
  private static final long MISSING_ID = 999999;

  @Autowired private TestRestTemplate restTemplate;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private PasswordEncoder passwordEncoder;

  @BeforeEach
  void resetBooks() {
    jdbc.update("DELETE FROM books");
    // A second account has to exist for the ownership tests; V1__init.sql only seeds `dev`.
    // Created here rather than in a migration — it is a test fixture, not production data.
    jdbc.update(
        "INSERT INTO users (username, password_hash) VALUES (?, ?) ON CONFLICT (username) DO NOTHING",
        OTHER_USERNAME,
        passwordEncoder.encode(OTHER_PASSWORD));
  }

  // --- Clients and requests ---

  private TestRestTemplate asDev() {
    return restTemplate.withBasicAuth("dev", "dev");
  }

  private TestRestTemplate asOther() {
    return restTemplate.withBasicAuth(OTHER_USERNAME, OTHER_PASSWORD);
  }

  private static HttpEntity<String> json(String body) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    return new HttpEntity<>(body, headers);
  }

  private BookResponse create(TestRestTemplate client, String title) {
    return create(client, new BookCreateRequest(title, null, null, null, null));
  }

  private BookResponse create(TestRestTemplate client, BookCreateRequest request) {
    ResponseEntity<BookResponse> response =
        client.postForEntity("/api/books", request, BookResponse.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    return response.getBody();
  }

  private BookResponse createWithPages(int totalPages) {
    return create(asDev(), new BookCreateRequest("t", null, null, totalPages, BookStatus.READING));
  }

  private BookResponse read(long id) {
    return asDev().getForEntity("/api/books/" + id, BookResponse.class).getBody();
  }

  private BookListResponse list(TestRestTemplate client, String query) {
    return client.getForEntity("/api/books" + query, BookListResponse.class).getBody();
  }

  private ResponseEntity<JsonNode> put(TestRestTemplate client, long id, Object body) {
    return client.exchange(
        "/api/books/" + id, HttpMethod.PUT, new HttpEntity<>(body), JsonNode.class);
  }

  private ResponseEntity<JsonNode> progress(TestRestTemplate client, long id, int currentPage) {
    return client.exchange(
        "/api/books/" + id + "/progress",
        HttpMethod.PUT,
        new HttpEntity<>(new BookProgressUpdateRequest(currentPage)),
        JsonNode.class);
  }

  private ResponseEntity<JsonNode> delete(TestRestTemplate client, long id) {
    return client.exchange("/api/books/" + id, HttpMethod.DELETE, null, JsonNode.class);
  }

  private int countRows(long id) {
    return jdbc.queryForObject("SELECT count(*) FROM books WHERE id = ?", Integer.class, id);
  }

  // --- Assertions ---

  /**
   * Every rejection must come back as RFC 9457 with the {@code errorCode} extension — that is the
   * one field a client is meant to branch on, whichever layer did the rejecting.
   */
  private static void assertProblemDetail(
      ResponseEntity<JsonNode> response, HttpStatus expectedStatus, String expectedErrorCode) {
    assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
    assertThat(response.getHeaders().getContentType())
        .isNotNull()
        .satisfies(
            type -> assertThat(type.isCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)).isTrue());
    assertThat(response.getBody().path("status").asInt()).isEqualTo(expectedStatus.value());
    assertThat(response.getBody().path("errorCode").asText()).isEqualTo(expectedErrorCode);
  }

  /** A 400 from bean validation, naming the field that failed (the frontend shows this name). */
  private static void assertRejectedField(ResponseEntity<JsonNode> response, String field) {
    assertProblemDetail(response, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
    assertThat(response.getBody().path("errors").get(0).path("field").asText()).isEqualTo(field);
  }

  // --- Parameter sources (static and outside the @Nested classes so JUnit can find them) ---

  static Stream<Arguments> invalidCreates() {
    return Stream.of(
        Arguments.of(new BookCreateRequest("a".repeat(256), null, null, null, null), "title"),
        Arguments.of(new BookCreateRequest("t", "a".repeat(256), null, null, null), "author"),
        Arguments.of(new BookCreateRequest("t", null, "1".repeat(21), null, null), "isbn"));
  }

  static Stream<Arguments> invalidUpdates() {
    return Stream.of(
        Arguments.of(new BookUpdateRequest("t", null, null, 0, BookStatus.READING), "totalPages"),
        Arguments.of(
            new BookUpdateRequest("a".repeat(256), null, null, null, BookStatus.READING), "title"),
        Arguments.of(
            new BookUpdateRequest("t", "a".repeat(256), null, null, BookStatus.READING), "author"),
        Arguments.of(
            new BookUpdateRequest("t", null, "1".repeat(21), null, BookStatus.READING), "isbn"));
  }

  @Nested
  class ListBooks {

    @Test
    void listRequiresAuthentication() {
      ResponseEntity<String> response = restTemplate.getForEntity("/api/books", String.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void createdBookAppearsInTheList() {
      create(asDev(), "一覧に出る本");

      ResponseEntity<BookListResponse> response =
          asDev().getForEntity("/api/books", BookListResponse.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().items())
          .extracting(BookResponse::title)
          .containsExactly("一覧に出る本");
    }

    @Test
    void listIsOrderedNewestFirst() {
      create(asDev(), "1 冊目");
      create(asDev(), "2 冊目");
      create(asDev(), "3 冊目");

      BookListResponse body = list(asDev(), "");

      assertThat(body.items())
          .extracting(BookResponse::title)
          .containsExactly("3 冊目", "2 冊目", "1 冊目");
    }

    /**
     * Owner scoping, read side. Drop the {@code WHERE user_id} clause and this fails. Both views
     * are read so that neither direction of the leak goes unnoticed.
     */
    @Test
    void listNeverReturnsAnotherUsersBooks() {
      create(asDev(), "dev の本");
      create(asOther(), "other の本");

      BookListResponse devView = list(asDev(), "");
      BookListResponse otherView = list(asOther(), "");

      assertThat(devView.items()).extracting(BookResponse::title).containsExactly("dev の本");
      assertThat(otherView.items()).extracting(BookResponse::title).containsExactly("other の本");
    }

    /** {@code limit} must reach the SQL. Hard-code it in the mapper and this is what fails. */
    @Test
    void limitCapsTheNumberOfRowsReturned() {
      create(asDev(), "1 冊目");
      create(asDev(), "2 冊目");
      create(asDev(), "3 冊目");

      BookListResponse body = list(asDev(), "?limit=2");

      assertThat(body.items()).extracting(BookResponse::title).containsExactly("3 冊目", "2 冊目");
    }

    /** Also the lower bound of {@code limit} (1) on the accepted side. */
    @Test
    void offsetSkipsRows() {
      create(asDev(), "古い");
      create(asDev(), "新しい");

      BookListResponse body = list(asDev(), "?limit=1&offset=1");

      assertThat(body.items()).extracting(BookResponse::title).containsExactly("古い");
    }

    /** The upper bound of {@code limit} on the accepted side; 101 is the rejected side. */
    @Test
    void limitAtTheMaximumIsAccepted() {
      ResponseEntity<JsonNode> response =
          asDev().getForEntity("/api/books?limit=" + BookService.MAX_LIMIT, JsonNode.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void limitAboveTheMaximumIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev().getForEntity("/api/books?limit=" + (BookService.MAX_LIMIT + 1), JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
    }

    @Test
    void limitBelowOneIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev().getForEntity("/api/books?limit=0", JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
    }

    @Test
    void negativeOffsetIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev().getForEntity("/api/books?offset=-1", JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
    }
  }

  @Nested
  class CreateBook {

    @Test
    void createRequiresAuthenticationAndStoresNothing() {
      ResponseEntity<String> response =
          restTemplate.postForEntity(
              "/api/books", new BookCreateRequest("t", null, null, null, null), String.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertThat(jdbc.queryForObject("SELECT count(*) FROM books", Integer.class)).isZero();
    }

    @Test
    void createsBookWithDefaults() {
      BookResponse created = create(asDev(), "デフォルトの本");

      assertThat(created.id()).isPositive();
      assertThat(created.title()).isEqualTo("デフォルトの本");
      assertThat(created.status()).isEqualTo(BookStatus.WANT_TO_READ);
      assertThat(created.currentPage()).isZero();
      assertThat(created.author()).isNull();
      assertThat(created.createdAt()).isNotNull();
    }

    /**
     * Owner scoping, write side. The row must be stamped with the authenticated user, so a book
     * created by `dev` is invisible to `other` no matter what the request body said.
     */
    @Test
    void createStampsTheAuthenticatedUserAsOwner() {
      BookResponse created = create(asDev(), "所有者の確認");

      Long ownerId =
          jdbc.queryForObject("SELECT user_id FROM books WHERE id = ?", Long.class, created.id());
      Long devId = jdbc.queryForObject("SELECT id FROM users WHERE username = 'dev'", Long.class);
      assertThat(ownerId).isEqualTo(devId);
    }

    /**
     * Every field the client can send must survive the round trip. Asserting only the defaults
     * would pass even if the request values were dropped on the way to the INSERT.
     */
    @Test
    void storesAndReturnsEveryFieldTheClientSent() {
      ResponseEntity<BookResponse> response =
          asDev()
              .postForEntity(
                  "/api/books",
                  new BookCreateRequest(
                      "リファクタリング", "Martin Fowler", "9784274224546", 480, BookStatus.READING),
                  BookResponse.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
      assertThat(response.getBody())
          .extracting(
              BookResponse::title,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages,
              BookResponse::status)
          .containsExactly("リファクタリング", "Martin Fowler", "9784274224546", 480, BookStatus.READING);
      // Read back through the list too: the POST response comes from the INSERT's RETURNING clause
      // and the list from its own SELECT, so `total_pages` / `current_page` can drift in the list
      // query alone — which the UI shows as the progress line silently disappearing.
      assertThat(list(asDev(), "").items())
          .singleElement()
          .extracting(
              BookResponse::status,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages,
              BookResponse::currentPage)
          .containsExactly(BookStatus.READING, "Martin Fowler", "9784274224546", 480, 0);
    }

    @ParameterizedTest
    @EnumSource(BookStatus.class)
    void acceptsEveryDeclaredStatus(BookStatus status) {
      ResponseEntity<BookResponse> response =
          asDev()
              .postForEntity(
                  "/api/books",
                  new BookCreateRequest("状態の確認", null, null, null, status),
                  BookResponse.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
      assertThat(response.getBody().status()).isEqualTo(status);
    }

    /** The accepted side of every bound: the column widths and {@code totalPages >= 1}. */
    @Test
    void acceptsValuesAtTheirLimits() {
      BookCreateRequest request =
          new BookCreateRequest("a".repeat(255), "b".repeat(255), "1".repeat(20), 1, null);

      BookResponse created = create(asDev(), request);

      assertThat(created)
          .extracting(
              BookResponse::title,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages)
          .containsExactly("a".repeat(255), "b".repeat(255), "1".repeat(20), 1);
      assertThat(read(created.id()))
          .extracting(
              BookResponse::title,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages)
          .containsExactly("a".repeat(255), "b".repeat(255), "1".repeat(20), 1);
    }

    /**
     * Asserts the shape of {@code errors[]}, not just that the words appear somewhere in the body.
     * The frontend builds its message from the {@code field} / {@code message} keys, and those key
     * names exist nowhere else in the codebase — renaming them breaks the UI silently.
     */
    @Test
    void blankTitleIsRejectedWithFieldLevelDetail() {
      ResponseEntity<JsonNode> response =
          asDev()
              .postForEntity(
                  "/api/books",
                  new BookCreateRequest("   ", null, null, null, null),
                  JsonNode.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
      JsonNode body = response.getBody();
      assertThat(body.path("errorCode").asText()).isEqualTo("VALIDATION_ERROR");
      assertThat(body.path("errors")).hasSize(1);
      JsonNode error = body.path("errors").get(0);
      assertThat(error.path("field").asText()).isEqualTo("title");
      assertThat(error.path("message").asText()).isEqualTo("title is required");
    }

    @Test
    void nonPositiveTotalPagesIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev()
              .postForEntity(
                  "/api/books", new BookCreateRequest("t", null, null, 0, null), JsonNode.class);

      assertRejectedField(response, "totalPages");
      assertThat(response.getBody().path("errors").get(0).path("message").asText())
          .isEqualTo("totalPages must be positive");
    }

    /**
     * Without the {@code @Size} limits each of these still fails — on the column width — but as a
     * 500 from the catch-all instead of a 400 naming the field.
     */
    @ParameterizedTest
    @MethodSource("com.example.readinglog.book.BookApiTest#invalidCreates")
    void createWithAnOverlongFieldIsRejected(BookCreateRequest request, String field) {
      ResponseEntity<JsonNode> response =
          asDev().postForEntity("/api/books", request, JsonNode.class);

      assertRejectedField(response, field);
    }

    /**
     * An unparseable body must not reach the catch-all in {@code ProblemDetailsAdvice} and come
     * back as a 500. The enum is the easy way for a client to trip this.
     */
    @Test
    void unknownStatusValueIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev()
              .postForEntity(
                  "/api/books", json("{\"title\":\"t\",\"status\":\"NOPE\"}"), JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }

    @Test
    void malformedJsonIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev().postForEntity("/api/books", json("{\"title\":"), JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }

    /** The Location must resolve: following it has to return the book that was just created. */
    @Test
    void createPointsLocationAtTheNewBook() {
      ResponseEntity<BookResponse> response =
          asDev()
              .postForEntity(
                  "/api/books",
                  new BookCreateRequest("場所", null, null, null, null),
                  BookResponse.class);

      assertThat(response.getHeaders().getLocation())
          .hasToString("/api/books/" + response.getBody().id());
      BookResponse followed =
          asDev()
              .getForEntity(response.getHeaders().getLocation().toString(), BookResponse.class)
              .getBody();
      assertThat(followed.title()).isEqualTo("場所");
    }
  }

  @Nested
  class GetBook {

    @Test
    void getReturnsTheOwnersBook() {
      BookResponse created = create(asDev(), "1 冊だけ");

      ResponseEntity<BookResponse> response =
          asDev().getForEntity("/api/books/" + created.id(), BookResponse.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().title()).isEqualTo("1 冊だけ");
    }

    @Test
    void getRequiresAuthentication() {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<String> response =
          restTemplate.getForEntity("/api/books/" + created.id(), String.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getOfAMissingBookIsNotFound() {
      ResponseEntity<JsonNode> response =
          asDev().getForEntity("/api/books/" + MISSING_ID, JsonNode.class);

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
    }

    /**
     * Owner scoping on the by-id path. Must be the same 404 as a missing id — a 403 would confirm
     * the id exists.
     */
    @Test
    void getOfAnotherUsersBookIsNotFound() {
      BookResponse devBook = create(asDev(), "dev の本");

      ResponseEntity<JsonNode> response =
          asOther().getForEntity("/api/books/" + devBook.id(), JsonNode.class);

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
    }

    /**
     * A non-numeric id fails to bind before any handler runs. It must come back as a client error,
     * not fall through to the catch-all in {@code ProblemDetailsAdvice} as a 500. The same check
     * sits in each by-id endpoint's class.
     */
    @Test
    void nonNumericIdIsRejected() {
      ResponseEntity<JsonNode> response = asDev().getForEntity("/api/books/abc", JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }
  }

  @Nested
  class UpdateBook {

    @Test
    void updateReplacesEveryEditableField() {
      BookResponse created = create(asDev(), "旧題");

      ResponseEntity<BookResponse> response =
          asDev()
              .exchange(
                  "/api/books/" + created.id(),
                  HttpMethod.PUT,
                  new HttpEntity<>(
                      new BookUpdateRequest(
                          "新題", "Martin Fowler", "9784274224546", 480, BookStatus.DONE)),
                  BookResponse.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      // The response comes from the UPDATE's RETURNING clause, a different column list from the
      // GET below, so each has to be asserted on its own.
      assertThat(response.getBody())
          .extracting(
              BookResponse::id,
              BookResponse::title,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages,
              BookResponse::status)
          .containsExactly(
              created.id(), "新題", "Martin Fowler", "9784274224546", 480, BookStatus.DONE);
      BookResponse read = read(created.id());
      assertThat(read)
          .extracting(
              BookResponse::title,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages,
              BookResponse::status)
          .containsExactly("新題", "Martin Fowler", "9784274224546", 480, BookStatus.DONE);
      assertThat(read.createdAt()).isEqualTo(created.createdAt());
      assertThat(read.updatedAt()).isAfter(created.updatedAt());
    }

    /**
     * The editable fields are the only ones PUT touches. Progress, rating and note have their own
     * write paths; a stray column in the SET clause would silently reset them, and a freshly
     * created book (0 / null / null) could not tell.
     */
    @Test
    void updateLeavesProgressRatingAndNoteAlone() {
      BookResponse created = create(asDev(), "t");
      // Set directly: rating and note have no write API yet (test-rules.md, "公開 API で作れない状態").
      jdbc.update(
          "UPDATE books SET current_page = ?, rating = ?, note = ? WHERE id = ?",
          42,
          4,
          "感想",
          created.id());

      ResponseEntity<BookResponse> response =
          asDev()
              .exchange(
                  "/api/books/" + created.id(),
                  HttpMethod.PUT,
                  new HttpEntity<>(
                      new BookUpdateRequest("新題", null, null, 100, BookStatus.READING)),
                  BookResponse.class);

      assertThat(response.getBody())
          .extracting(BookResponse::currentPage, BookResponse::rating, BookResponse::note)
          .containsExactly(42, (short) 4, "感想");
      assertThat(read(created.id()))
          .extracting(BookResponse::currentPage, BookResponse::rating, BookResponse::note)
          .containsExactly(42, (short) 4, "感想");
    }

    /** PUT is a full replacement: an omitted optional field is cleared, not kept. */
    @Test
    void updateClearsOmittedOptionalFields() {
      BookResponse created =
          create(asDev(), new BookCreateRequest("t", "著者", "isbn", 100, BookStatus.READING));

      ResponseEntity<JsonNode> response =
          put(
              asDev(),
              created.id(),
              new BookUpdateRequest("t", null, null, null, BookStatus.READING));

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().path("author").isNull()).isTrue();
      assertThat(response.getBody().path("isbn").isNull()).isTrue();
      assertThat(response.getBody().path("totalPages").isNull()).isTrue();
      assertThat(read(created.id()))
          .extracting(BookResponse::author, BookResponse::isbn, BookResponse::totalPages)
          .containsOnlyNulls();
    }

    /** The accepted side of every bound {@link #updateWithInvalidFieldsIsRejected} rejects. */
    @Test
    void updateAcceptsValuesAtTheirLimits() {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<JsonNode> response =
          put(
              asDev(),
              created.id(),
              new BookUpdateRequest(
                  "a".repeat(255), "b".repeat(255), "1".repeat(20), 1, BookStatus.READING));

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(read(created.id()))
          .extracting(
              BookResponse::title,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages)
          .containsExactly("a".repeat(255), "b".repeat(255), "1".repeat(20), 1);
    }

    /**
     * Status is required rather than defaulted: defaulting would move a book being read back to
     * WANT_TO_READ whenever a client forgot the field.
     */
    @Test
    void updateWithoutStatusIsRejected() {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<JsonNode> response =
          put(asDev(), created.id(), new BookUpdateRequest("t", null, null, null, null));

      assertRejectedField(response, "status");
    }

    @Test
    void updateWithBlankTitleIsRejected() {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<JsonNode> response =
          put(
              asDev(),
              created.id(),
              new BookUpdateRequest(" ", null, null, null, BookStatus.READING));

      assertRejectedField(response, "title");
    }

    /**
     * {@code BookUpdateRequest} declares its constraints separately from {@code BookCreateRequest}.
     * Without them each of these still fails — on a database CHECK or column width — but as a 500
     * from the catch-all instead of a 400 naming the field.
     */
    @ParameterizedTest
    @MethodSource("com.example.readinglog.book.BookApiTest#invalidUpdates")
    void updateWithInvalidFieldsIsRejected(BookUpdateRequest request, String field) {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<JsonNode> response = put(asDev(), created.id(), request);

      assertRejectedField(response, field);
    }

    /**
     * The progress endpoint refuses a page beyond {@code totalPages}; without the same guard here,
     * editing the total down would reach that state by the back door and the progress bar would
     * pass 100%. One below the recorded page is the rejected side of the bound.
     */
    @Test
    void updateShrinkingTotalPagesBelowTheRecordedPageIsRejectedAndChangesNothing() {
      BookResponse created = createWithPages(100);
      progress(asDev(), created.id(), 80);

      ResponseEntity<JsonNode> response =
          put(asDev(), created.id(), new BookUpdateRequest("新題", null, null, 79, BookStatus.DONE));

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
      assertThat(read(created.id()))
          .extracting(BookResponse::title, BookResponse::totalPages, BookResponse::currentPage)
          .containsExactly("t", 100, 80);
    }

    /** The accepted side of the bound above: the total may equal the recorded page. */
    @Test
    void updateAllowsTotalPagesEqualToTheRecordedPage() {
      BookResponse created = createWithPages(100);
      progress(asDev(), created.id(), 80);

      ResponseEntity<JsonNode> response =
          put(
              asDev(),
              created.id(),
              new BookUpdateRequest("t", null, null, 80, BookStatus.READING));

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().path("totalPages").asInt()).isEqualTo(80);
      assertThat(response.getBody().path("currentPage").asInt()).isEqualTo(80);
    }

    /** Without a total there is nothing to exceed, so clearing it is allowed at any page. */
    @Test
    void updateAllowsClearingTotalPagesAfterProgress() {
      BookResponse created = createWithPages(100);
      progress(asDev(), created.id(), 80);

      ResponseEntity<JsonNode> response =
          put(
              asDev(),
              created.id(),
              new BookUpdateRequest("t", null, null, null, BookStatus.READING));

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().path("totalPages").isNull()).isTrue();
      assertThat(response.getBody().path("currentPage").asInt()).isEqualTo(80);
    }

    @Test
    void updateOfAMissingBookIsNotFound() {
      ResponseEntity<JsonNode> response =
          put(
              asDev(),
              MISSING_ID,
              new BookUpdateRequest("t", null, null, null, BookStatus.READING));

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
    }

    /** Owner scoping, update side: rejected as 404 and the row is left exactly as it was. */
    @Test
    void updateOfAnotherUsersBookIsNotFoundAndChangesNothing() {
      BookResponse devBook = create(asDev(), "dev の本");

      ResponseEntity<JsonNode> response =
          put(
              asOther(),
              devBook.id(),
              new BookUpdateRequest("乗っ取り", null, null, null, BookStatus.DONE));

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
      assertThat(read(devBook.id()))
          .extracting(BookResponse::title, BookResponse::status)
          .containsExactly("dev の本", BookStatus.WANT_TO_READ);
    }

    @Test
    void updateRequiresAuthenticationAndChangesNothing() {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<String> response =
          restTemplate.exchange(
              "/api/books/" + created.id(),
              HttpMethod.PUT,
              new HttpEntity<>(new BookUpdateRequest("x", null, null, null, BookStatus.DONE)),
              String.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertThat(read(created.id()))
          .extracting(BookResponse::title, BookResponse::status)
          .containsExactly("t", BookStatus.WANT_TO_READ);
    }

    @Test
    void nonNumericIdIsRejected() {
      ResponseEntity<JsonNode> response =
          putRaw(asDev(), "abc", new BookUpdateRequest("t", null, null, null, BookStatus.READING));

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }

    private ResponseEntity<JsonNode> putRaw(TestRestTemplate client, String rawId, Object body) {
      return client.exchange(
          "/api/books/" + rawId, HttpMethod.PUT, new HttpEntity<>(body), JsonNode.class);
    }
  }

  @Nested
  class UpdateProgress {

    /** Read back over GET as well, for the reason updateReplacesEveryEditableField gives. */
    @Test
    void progressRecordsThePage() {
      BookResponse created = createWithPages(300);

      ResponseEntity<JsonNode> response = progress(asDev(), created.id(), 120);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().path("currentPage").asInt()).isEqualTo(120);
      assertThat(read(created.id()).currentPage()).isEqualTo(120);
    }

    /**
     * Only the page moves. Reaching the last page does not mark the book done, and the
     * bibliographic fields are not touched.
     */
    @Test
    void progressLeavesEverythingElseAlone() {
      BookResponse created =
          create(asDev(), new BookCreateRequest("書名", "著者", "isbn", 300, BookStatus.READING));

      ResponseEntity<JsonNode> response = progress(asDev(), created.id(), 300);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(read(created.id()))
          .extracting(
              BookResponse::title,
              BookResponse::author,
              BookResponse::isbn,
              BookResponse::totalPages,
              BookResponse::status)
          .containsExactly("書名", "著者", "isbn", 300, BookStatus.READING);
    }

    /** The upper bound on the accepted side: the last page must be recordable. */
    @Test
    void progressAtExactlyTotalPagesIsAccepted() {
      BookResponse created = createWithPages(300);

      ResponseEntity<JsonNode> response = progress(asDev(), created.id(), 300);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().path("currentPage").asInt()).isEqualTo(300);
      assertThat(read(created.id()).currentPage()).isEqualTo(300);
    }

    @Test
    void progressBeyondTotalPagesIsRejectedAndChangesNothing() {
      BookResponse created = createWithPages(300);
      progress(asDev(), created.id(), 100);

      ResponseEntity<JsonNode> response = progress(asDev(), created.id(), 301);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
      assertThat(read(created.id()).currentPage()).isEqualTo(100);
    }

    /** The lower bound on the accepted side: going back to the start is allowed. */
    @Test
    void progressBackToZeroIsAccepted() {
      BookResponse created = createWithPages(300);
      progress(asDev(), created.id(), 100);

      ResponseEntity<JsonNode> response = progress(asDev(), created.id(), 0);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().path("currentPage").asInt()).isZero();
      assertThat(read(created.id()).currentPage()).isZero();
    }

    /**
     * Without a total there is nothing to measure against, so any non-negative page is accepted.
     */
    @Test
    void progressWithoutTotalPagesHasNoUpperBound() {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<JsonNode> response = progress(asDev(), created.id(), 5000);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody().path("currentPage").asInt()).isEqualTo(5000);
    }

    /**
     * Without the bean validation these would still fail — on the NOT NULL / CHECK constraints —
     * but as a 500 instead of a 400 naming the field.
     */
    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"currentPage\": null}", "{\"currentPage\": -1}"})
    void progressWithAnInvalidPageIsRejected(String body) {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<JsonNode> response =
          asDev()
              .exchange(
                  "/api/books/" + created.id() + "/progress",
                  HttpMethod.PUT,
                  json(body),
                  JsonNode.class);

      assertRejectedField(response, "currentPage");
    }

    @Test
    void progressOfAMissingBookIsNotFound() {
      ResponseEntity<JsonNode> response = progress(asDev(), MISSING_ID, 1);

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
    }

    /**
     * Owner scoping, progress side. Both a page in range and one beyond the total, so the not-found
     * answer is shown to win over the bound check: reporting "exceeds totalPages" for someone
     * else's book would confirm that it exists.
     */
    @ParameterizedTest
    @ValueSource(ints = {10, 999})
    void progressOfAnotherUsersBookIsNotFoundAndChangesNothing(int currentPage) {
      BookResponse devBook = createWithPages(300);

      ResponseEntity<JsonNode> response = progress(asOther(), devBook.id(), currentPage);

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
      assertThat(read(devBook.id()).currentPage()).isZero();
    }

    @Test
    void progressRequiresAuthenticationAndChangesNothing() {
      BookResponse created = createWithPages(300);

      ResponseEntity<String> response =
          restTemplate.exchange(
              "/api/books/" + created.id() + "/progress",
              HttpMethod.PUT,
              new HttpEntity<>(new BookProgressUpdateRequest(10)),
              String.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertThat(read(created.id()).currentPage()).isZero();
    }

    @Test
    void nonNumericIdIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev()
              .exchange(
                  "/api/books/abc/progress",
                  HttpMethod.PUT,
                  new HttpEntity<>(new BookProgressUpdateRequest(1)),
                  JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }
  }

  @Nested
  class DeleteBook {

    @Test
    void deleteRemovesTheBook() {
      BookResponse created = create(asDev(), "消す本");

      ResponseEntity<JsonNode> response = delete(asDev(), created.id());

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
      assertProblemDetail(
          asDev().getForEntity("/api/books/" + created.id(), JsonNode.class),
          HttpStatus.NOT_FOUND,
          "BOOK_NOT_FOUND");
    }

    @Test
    void deleteOfAMissingBookIsNotFound() {
      ResponseEntity<JsonNode> response = delete(asDev(), MISSING_ID);

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
    }

    /** Owner scoping, delete side: rejected as 404 and the row survives. */
    @Test
    void deleteOfAnotherUsersBookIsNotFoundAndKeepsTheRow() {
      BookResponse devBook = create(asDev(), "dev の本");

      ResponseEntity<JsonNode> response = delete(asOther(), devBook.id());

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND");
      assertThat(countRows(devBook.id())).isEqualTo(1);
    }

    @Test
    void deleteRequiresAuthenticationAndKeepsTheRow() {
      BookResponse created = create(asDev(), "t");

      ResponseEntity<String> response =
          restTemplate.exchange(
              "/api/books/" + created.id(), HttpMethod.DELETE, null, String.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertThat(countRows(created.id())).isEqualTo(1);
    }

    @Test
    void nonNumericIdIsRejected() {
      ResponseEntity<JsonNode> response =
          asDev().exchange("/api/books/abc", HttpMethod.DELETE, null, JsonNode.class);

      assertProblemDetail(response, HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }
  }

  /**
   * The {@code errorCode} must follow the status, not be a single value for every 4xx. A 404 and a
   * 405 are the cheapest ways to observe that: both go through {@code handleExceptionInternal},
   * which is where the derivation lives.
   */
  @Nested
  class ErrorCodes {

    @Test
    void unknownPathIsNotFoundRatherThan400() {
      ResponseEntity<JsonNode> response =
          asDev().getForEntity("/api/does-not-exist", JsonNode.class);

      assertProblemDetail(response, HttpStatus.NOT_FOUND, "NOT_FOUND");
    }

    @Test
    void unsupportedMethodIsMethodNotAllowedRatherThan400() {
      ResponseEntity<JsonNode> response =
          asDev().exchange("/api/books", HttpMethod.DELETE, null, JsonNode.class);

      assertProblemDetail(response, HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED");
    }
  }
}
