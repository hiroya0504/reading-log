package com.example.readinglog.book;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.readinglog.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * End-to-end coverage of {@code /api/books} against a real PostgreSQL.
 *
 * <p>The two ownership tests are the point of this class. Nothing else in the codebase stops a
 * missing {@code user_id} filter from exposing one user's books to another, and that regression
 * would not show up as a failure anywhere else.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class BookApiTest {

  private static final String OTHER_USERNAME = "other";
  private static final String OTHER_PASSWORD = "other-password";

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

  private TestRestTemplate asDev() {
    return restTemplate.withBasicAuth("dev", "dev");
  }

  private TestRestTemplate asOther() {
    return restTemplate.withBasicAuth(OTHER_USERNAME, OTHER_PASSWORD);
  }

  private BookResponse create(TestRestTemplate client, String title) {
    ResponseEntity<BookResponse> response =
        client.postForEntity(
            "/api/books", new BookCreateRequest(title, null, null, null, null), BookResponse.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    return response.getBody();
  }

  @Test
  void listRequiresAuthentication() {
    ResponseEntity<String> response = restTemplate.getForEntity("/api/books", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void createRequiresAuthentication() {
    ResponseEntity<String> response =
        restTemplate.postForEntity(
            "/api/books", new BookCreateRequest("t", null, null, null, null), String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
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

    BookListResponse body = asDev().getForEntity("/api/books", BookListResponse.class).getBody();

    assertThat(body.items())
        .extracting(BookResponse::title)
        .containsExactly("3 冊目", "2 冊目", "1 冊目");
  }

  /** Owner scoping, read side. Drop the {@code WHERE user_id} clause and this fails. */
  @Test
  void listNeverReturnsAnotherUsersBooks() {
    create(asDev(), "dev の本");
    create(asOther(), "other の本");

    BookListResponse devView = asDev().getForEntity("/api/books", BookListResponse.class).getBody();
    BookListResponse otherView =
        asOther().getForEntity("/api/books", BookListResponse.class).getBody();

    assertThat(devView.items()).extracting(BookResponse::title).containsExactly("dev の本");
    assertThat(otherView.items()).extracting(BookResponse::title).containsExactly("other の本");
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

  @Test
  void blankTitleIsRejectedWithFieldLevelDetail() {
    ResponseEntity<String> response =
        asDev()
            .postForEntity(
                "/api/books", new BookCreateRequest("   ", null, null, null, null), String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody()).contains("VALIDATION_ERROR").contains("title");
  }

  @Test
  void nonPositiveTotalPagesIsRejected() {
    ResponseEntity<String> response =
        asDev()
            .postForEntity(
                "/api/books", new BookCreateRequest("t", null, null, 0, null), String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody()).contains("totalPages");
  }

  /**
   * An unparseable body must not reach the catch-all in {@code ProblemDetailsAdvice} and come back
   * as a 500. The enum is the easy way for a client to trip this.
   */
  @Test
  void unknownStatusValueIsRejected() {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    ResponseEntity<String> response =
        asDev()
            .postForEntity(
                "/api/books",
                new HttpEntity<>("{\"title\":\"t\",\"status\":\"NOPE\"}", headers),
                String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void malformedJsonIsRejected() {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    ResponseEntity<String> response =
        asDev().postForEntity("/api/books", new HttpEntity<>("{\"title\":", headers), String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void limitAboveTheMaximumIsRejected() {
    ResponseEntity<String> response = asDev().getForEntity("/api/books?limit=101", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void negativeOffsetIsRejected() {
    ResponseEntity<String> response = asDev().getForEntity("/api/books?offset=-1", String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void offsetSkipsRows() {
    create(asDev(), "古い");
    create(asDev(), "新しい");

    BookListResponse body =
        asDev().getForEntity("/api/books?limit=1&offset=1", BookListResponse.class).getBody();

    assertThat(body.items()).extracting(BookResponse::title).containsExactly("古い");
  }
}
