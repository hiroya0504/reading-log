package com.example.readinglog.repository.http.googlebooks;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.readinglog.booksearch.BookCandidate;
import com.example.readinglog.common.error.BadGatewayException;
import com.example.readinglog.common.error.ServiceUnavailableException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.client.RestClient;

/**
 * The translation from Google's volume shape to {@link BookCandidate}, against {@link
 * FakeGoogleBooks}. No Spring context: the catalog is built directly, as the app builds it.
 */
class GoogleBooksClientTest {

  private static final FakeGoogleBooks google = new FakeGoogleBooks();

  @AfterAll
  static void stop() {
    google.close();
  }

  private static GoogleBooksClient catalog(String apiKey) {
    return new GoogleBooksClient(
        RestClient.builder(),
        new GoogleBooksProperties(google.baseUrl(), apiKey, Duration.ofSeconds(2)));
  }

  private static List<BookCandidate> searchWith(String volumeInfoJson) {
    google.answer(200, "{\"items\":[{\"volumeInfo\":" + volumeInfoJson + "}]}");
    return catalog("key").search("q");
  }

  @Test
  void mapsEveryField() {
    List<BookCandidate> found =
        searchWith(
            """
            {"title":"リファクタリング","authors":["Martin Fowler","Kent Beck"],"pageCount":480,
             "industryIdentifiers":[{"type":"ISBN_10","identifier":"4274224546"},
                                    {"type":"ISBN_13","identifier":"9784274224546"}],
             "imageLinks":{"smallThumbnail":"http://books.google.com/s","thumbnail":"http://books.google.com/t"}}
            """);

    assertThat(found)
        .containsExactly(
            new BookCandidate(
                "リファクタリング",
                "Martin Fowler, Kent Beck",
                "9784274224546",
                480,
                "https://books.google.com/t"));
  }

  @Test
  void fallsBackToIsbn10WhenThereIsNoIsbn13() {
    List<BookCandidate> found =
        searchWith(
            """
            {"title":"t","industryIdentifiers":[{"type":"OTHER","identifier":"X"},
                                                {"type":"ISBN_10","identifier":"4274224546"}]}
            """);

    assertThat(found.getFirst().isbn()).isEqualTo("4274224546");
  }

  @Test
  void fallsBackToTheSmallThumbnailWhenThereIsNoThumbnail() {
    List<BookCandidate> found =
        searchWith(
            "{\"title\":\"t\",\"imageLinks\":{\"smallThumbnail\":\"http://books.google.com/s\"}}");

    assertThat(found.getFirst().coverUrl()).isEqualTo("https://books.google.com/s");
  }

  /** The book feature only stores Google's image hosts, so anything else is dropped here. */
  @Test
  void dropsACoverOnAnyOtherHost() {
    List<BookCandidate> found =
        searchWith("{\"title\":\"t\",\"imageLinks\":{\"thumbnail\":\"http://example.com/t.png\"}}");

    assertThat(found.getFirst().coverUrl()).isNull();
  }

  @Test
  void leavesEveryMissingFieldNull() {
    List<BookCandidate> found = searchWith("{\"title\":\"t\"}");

    assertThat(found).containsExactly(new BookCandidate("t", null, null, null, null));
  }

  /** The accepted side of {@code pageCount > 0}. */
  @Test
  void keepsAPageCountOfOne() {
    List<BookCandidate> found = searchWith("{\"title\":\"t\",\"pageCount\":1}");

    assertThat(found.getFirst().totalPages()).isEqualTo(1);
  }

  /** The rejected side: Google reports 0 for "unknown", which the book feature would refuse. */
  @Test
  void dropsAPageCountOfZero() {
    List<BookCandidate> found = searchWith("{\"title\":\"t\",\"pageCount\":0}");

    assertThat(found.getFirst().totalPages()).isNull();
  }

  /** A title is the one thing the form cannot do without. */
  @Test
  void skipsVolumesWithoutATitle() {
    google.answer(
        200,
        """
        {"items":[{"volumeInfo":{"authors":["a"]}},{"volumeInfo":{"title":" "}},
                  {},{"volumeInfo":{"title":"残る"}}]}
        """);

    assertThat(catalog("key").search("q")).extracting(BookCandidate::title).containsExactly("残る");
  }

  /** Google leaves `items` out entirely when nothing matched. */
  @Test
  void readsAnAnswerWithoutItemsAsNoMatches() {
    google.answer(200, "{\"kind\":\"books#volumes\",\"totalItems\":0}");

    assertThat(catalog("key").search("q")).isEmpty();
  }

  @Test
  void sendsTheQueryWithTheKey() {
    google.answer(200, "{}");

    catalog("secret").search("単体 テスト");

    assertThat(google.requests())
        .singleElement()
        .satisfies(
            uri -> {
              assertThat(uri.getPath()).isEqualTo("/volumes");
              assertThat(uri.getQuery())
                  .contains("q=単体 テスト", "maxResults=10", "printType=books", "key=secret");
            });
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "  "})
  void sendsNoKeyWhenNoneIsConfigured(String apiKey) {
    google.answer(200, "{}");

    catalog(apiKey).search("q");

    assertThat(google.requests().getFirst().getQuery()).doesNotContain("key=");
  }

  @Test
  void reportsTheDailyLimitSeparately() {
    google.answer(429, "{\"error\":{\"code\":429}}");

    assertThatThrownBy(() -> catalog("key").search("q"))
        .isInstanceOf(ServiceUnavailableException.class)
        .extracting("errorCode")
        .isEqualTo("BOOK_SEARCH_QUOTA_EXCEEDED");
  }

  @ParameterizedTest
  @ValueSource(ints = {400, 403, 500, 503})
  void reportsAnyOtherFailureAsUnavailable(int status) {
    google.answer(status, "{\"error\":{}}");

    assertThatThrownBy(() -> catalog("key").search("q"))
        .isInstanceOf(BadGatewayException.class)
        .extracting("errorCode")
        .isEqualTo("BOOK_SEARCH_UNAVAILABLE");
  }

  @Test
  void reportsAnUnreadableAnswerAsUnavailable() {
    google.answer(200, "not json");

    assertThatThrownBy(() -> catalog("key").search("q")).isInstanceOf(BadGatewayException.class);
  }
}
