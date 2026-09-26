package com.example.readinglog.repository.http.googlebooks;

import com.example.readinglog.booksearch.BookCandidate;
import com.example.readinglog.booksearch.BookCatalog;
import com.example.readinglog.common.error.BadGatewayException;
import com.example.readinglog.common.error.ServiceUnavailableException;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * {@link BookCatalog} over the Google Books API ({@code GET /volumes?q=}).
 *
 * <p>Follows the rule for external HTTP calls (backend/CLAUDE.md, ARCH-001): it answers in the
 * feature's own types, so Google's response shape ({@code volumeInfo}, {@code industryIdentifiers})
 * and its failures (status codes, timeouts) stay inside this package.
 */
@Component
public class GoogleBooksClient implements BookCatalog {

  private static final Logger log = LoggerFactory.getLogger(GoogleBooksClient.class);

  /** Enough to pick from without scrolling; the catalog's own maximum is 40. */
  static final int MAX_RESULTS = 10;

  /**
   * Mirrors {@code CoverUrls} in the book feature. Not imported: this client implements the book
   * search's port and depends on that feature only.
   */
  private static final Pattern COVER_HOST =
      Pattern.compile("^https://(books\\.google\\.com|books\\.googleusercontent\\.com)/.*$");

  private final RestClient restClient;
  private final String apiKey;

  public GoogleBooksClient(RestClient.Builder builder, GoogleBooksProperties properties) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(properties.timeout());
    requestFactory.setReadTimeout(properties.timeout());
    this.restClient = builder.baseUrl(properties.baseUrl()).requestFactory(requestFactory).build();
    this.apiKey = properties.apiKey();
  }

  @Override
  public List<BookCandidate> search(String query) {
    Volumes volumes;
    try {
      volumes =
          restClient
              .get()
              .uri(
                  uri -> {
                    uri.path("/volumes")
                        .queryParam("q", query)
                        .queryParam("maxResults", MAX_RESULTS)
                        .queryParam("printType", "books");
                    if (apiKey != null && !apiKey.isBlank()) {
                      uri.queryParam("key", apiKey);
                    }
                    return uri.build();
                  })
              .retrieve()
              .body(Volumes.class);
    } catch (RestClientResponseException e) {
      log.warn("Google Books answered {}", e.getStatusCode(), e);
      if (e.getStatusCode().isSameCodeAs(HttpStatus.TOO_MANY_REQUESTS)) {
        throw new ServiceUnavailableException(
            "BOOK_SEARCH_QUOTA_EXCEEDED", "book search has reached its daily limit");
      }
      throw new BadGatewayException("BOOK_SEARCH_UNAVAILABLE", "book search failed");
    } catch (RestClientException e) {
      // Timeouts, refused connections and unreadable bodies: all "the catalog did not answer".
      log.warn("Google Books could not be reached", e);
      throw new BadGatewayException("BOOK_SEARCH_UNAVAILABLE", "book search failed");
    }
    if (volumes == null || volumes.items() == null) {
      // No `items` at all is how Google spells zero results.
      return List.of();
    }
    return volumes.items().stream()
        .map(Volume::volumeInfo)
        .filter(Objects::nonNull)
        .filter(info -> info.title() != null && !info.title().isBlank())
        .map(GoogleBooksClient::toCandidate)
        .toList();
  }

  static BookCandidate toCandidate(VolumeInfo info) {
    return new BookCandidate(
        info.title(),
        info.authors() == null || info.authors().isEmpty()
            ? null
            : String.join(", ", info.authors()),
        isbn(info.industryIdentifiers()),
        info.pageCount() != null && info.pageCount() > 0 ? info.pageCount() : null,
        coverUrl(info.imageLinks()));
  }

  /** ISBN-13 when there is one, since that is what a printed barcode carries; else ISBN-10. */
  static String isbn(List<Identifier> identifiers) {
    if (identifiers == null) {
      return null;
    }
    return identifiers.stream()
        .filter(id -> "ISBN_13".equals(id.type()))
        .findFirst()
        .or(() -> identifiers.stream().filter(id -> "ISBN_10".equals(id.type())).findFirst())
        .map(Identifier::identifier)
        .orElse(null);
  }

  /**
   * Google hands out {@code http://} thumbnail links; they are served over https as well, and a
   * mixed-content image would be blocked on an https page. A URL on any other host is dropped
   * rather than passed on, because the book feature would reject it on save.
   */
  static String coverUrl(ImageLinks links) {
    if (links == null) {
      return null;
    }
    String url = links.thumbnail() != null ? links.thumbnail() : links.smallThumbnail();
    if (url == null) {
      return null;
    }
    String https = url.replaceFirst("^http://", "https://");
    return COVER_HOST.matcher(https).matches() ? https : null;
  }

  record Volumes(List<Volume> items) {}

  record Volume(VolumeInfo volumeInfo) {}

  record VolumeInfo(
      String title,
      List<String> authors,
      Integer pageCount,
      List<Identifier> industryIdentifiers,
      ImageLinks imageLinks) {}

  record Identifier(String type, String identifier) {}

  record ImageLinks(String smallThumbnail, String thumbnail) {}
}
