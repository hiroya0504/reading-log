package com.example.readinglog.common.security;

/**
 * Identity of an authenticated user. Lives in {@code common} rather than in the {@code user}
 * feature because every feature needs it to scope its own rows, and {@code common} must not depend
 * on a feature package.
 */
public record UserId(long value) {

  public UserId {
    if (value <= 0) {
      throw new IllegalArgumentException("UserId must be positive, got " + value);
    }
  }
}
