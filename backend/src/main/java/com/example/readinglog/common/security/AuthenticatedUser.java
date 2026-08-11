package com.example.readinglog.common.security;

import java.util.Collection;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

/**
 * {@link org.springframework.security.core.userdetails.UserDetails} that carries our own {@link
 * UserId} alongside the username, so resolving the acting user costs no extra database round trip
 * per request.
 */
public class AuthenticatedUser extends User {

  private final transient UserId userId;

  public AuthenticatedUser(
      UserId userId,
      String username,
      String password,
      Collection<? extends GrantedAuthority> authorities) {
    super(username, password, authorities);
    this.userId = userId;
  }

  public UserId userId() {
    return userId;
  }
}
