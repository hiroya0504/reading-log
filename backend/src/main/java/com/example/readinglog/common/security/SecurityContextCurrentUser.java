package com.example.readinglog.common.security;

import com.example.readinglog.common.error.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * The <b>only</b> class in the application allowed to read from {@link SecurityContextHolder}.
 *
 * <p>Swapping HTTP Basic for JWT or OAuth means changing how {@link AuthenticatedUser} lands in the
 * security context — not changing any caller. Keep it that way.
 */
@Component
public class SecurityContextCurrentUser implements CurrentUser {

  @Override
  public UserId requireUserId() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new UnauthorizedException("No authenticated user on the current request");
    }
    if (authentication.getPrincipal() instanceof AuthenticatedUser user) {
      return user.userId();
    }
    // Reached when something authenticated the request but did not populate our principal type
    // (e.g. an anonymous token). Treat it as unauthenticated rather than guessing an identity.
    throw new UnauthorizedException("Authenticated principal does not carry a user id");
  }
}
