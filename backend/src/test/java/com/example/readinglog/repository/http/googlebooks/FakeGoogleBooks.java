package com.example.readinglog.repository.http.googlebooks;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Stand-in for the Google Books API: an out-of-process dependency the app does not own, so tests
 * talk to this instead of the network (test-rules.md, "土台"). It answers every request with the
 * status and body set last, and records the request URIs.
 */
public final class FakeGoogleBooks implements AutoCloseable {

  private final HttpServer server;
  private final List<URI> requests = new CopyOnWriteArrayList<>();
  private volatile int status = 200;
  private volatile String body = "{}";
  private volatile Duration delay = Duration.ZERO;

  public FakeGoogleBooks() {
    try {
      server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    server.createContext(
        "/",
        exchange -> {
          requests.add(exchange.getRequestURI());
          try {
            Thread.sleep(delay.toMillis());
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
          byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, bytes.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
          }
        });
    server.start();
  }

  public String baseUrl() {
    return "http://localhost:" + server.getAddress().getPort();
  }

  public void answer(int status, String body) {
    answerAfter(Duration.ZERO, status, body);
  }

  /** As {@link #answer}, but only after {@code delay} — for exercising the client's timeout. */
  public void answerAfter(Duration delay, int status, String body) {
    this.delay = delay;
    this.status = status;
    this.body = body;
    requests.clear();
  }

  public List<URI> requests() {
    return requests;
  }

  @Override
  public void close() {
    server.stop(0);
  }
}
