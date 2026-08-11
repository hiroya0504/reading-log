package com.example.readinglog.user;

import com.example.readinglog.common.security.AuthenticatedUser;
import com.example.readinglog.common.security.UserId;
import java.util.List;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Loads credentials from the {@code users} table.
 *
 * <p>Deliberately not {@code InMemoryUserDetailsManager} / {@code spring.security.user.*}: those
 * leave no user row in the database, and the ownership FK on domain tables would have nothing to
 * point at. Keeping users in the database is what makes the later switch to JWT or OAuth a
 * code-only change.
 */
@Service
public class DatabaseUserDetailsService implements UserDetailsService {

  private final UserMapper userMapper;

  public DatabaseUserDetailsService(UserMapper userMapper) {
    this.userMapper = userMapper;
  }

  @Override
  public UserDetails loadUserByUsername(String username) {
    User user = userMapper.findByUsername(username);
    if (user == null) {
      throw new UsernameNotFoundException("No user named " + username);
    }
    return new AuthenticatedUser(
        new UserId(user.id()), user.username(), user.passwordHash(), List.of());
  }
}
