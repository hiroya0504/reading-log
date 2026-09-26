package com.example.readinglog.booksearch;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Stand-in for the Google Books API: an out-of-process dependency the app does not own, so tests
 * talk to this instead of the network (test-rules.md, "土台"). It answers every request with the
 * status and body set last, and records the request URIs.
 */
final class FakeGoogleBooks implements AutoCloseable {

  private final HttpServer server;
  private final List<URI> requests = new CopyOnWriteArrayList<>();
  private volatile int status = 200;
  private volatile String body = "{}";

  FakeGoogleBooks() {
    try {
      server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    server.createContext(
        "/",
        exchange -> {
          requests.add(exchange.getRequestURI());
          byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, bytes.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
          }
        });
    server.start();
  }

  String baseUrl() {
    return "http://localhost:" + server.getAddress().getPort();
  }

  void answer(int status, String body) {
    this.status = status;
    this.body = body;
    requests.clear();
  }

  List<URI> requests() {
    return requests;
  }

  @Override
  public void close() {
    server.stop(0);
  }
}
