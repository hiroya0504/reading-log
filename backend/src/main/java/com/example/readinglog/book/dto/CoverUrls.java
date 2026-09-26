package com.example.readinglog.book.dto;

/**
 * The cover URLs a book may carry. Only Google Books' own image hosts over https: the URL is put
 * into an {@code <img>} on the owner's page, and the frontend's image optimiser is configured for
 * exactly these hosts, so any other URL would either leak where the page is viewed from or fail to
 * render.
 */
public final class CoverUrls {

  public static final String PATTERN =
      "^https://(books\\.google\\.com|books\\.googleusercontent\\.com)/.*$";

  private CoverUrls() {}
}
