package com.example.readinglog.repository.http.googlebooks;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code google-books.*} in application.yml. A blank {@code apiKey} sends no key. */
@ConfigurationProperties(prefix = "google-books")
public record GoogleBooksProperties(String baseUrl, String apiKey, Duration timeout) {}
