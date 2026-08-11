package com.example.readinglog.common.security;

/**
 * The single way application code learns who is acting.
 *
 * <p>Controllers and services must depend on this port instead of touching {@code
 * SecurityContextHolder}, {@code Authentication} or {@code Principal} directly. The MVP
 * authenticates over HTTP Basic; when that is replaced by JWT or OAuth, {@link
 * SecurityContextCurrentUser} is the only class that has to change.
 */
public interface CurrentUser {

  /**
   * @return the acting user's id
   * @throws com.example.readinglog.common.error.UnauthorizedException if there is no authenticated
   *     user on the current request
   */
  UserId requireUserId();
}
