package com.example.readinglog.user;

import com.example.readinglog.common.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "user")
public class MeController {

  private final UserMapper userMapper;
  private final CurrentUser currentUser;

  public MeController(UserMapper userMapper, CurrentUser currentUser) {
    this.userMapper = userMapper;
    this.currentUser = currentUser;
  }

  @Operation(operationId = "getMe", summary = "The authenticated user's account.")
  @GetMapping("/me")
  public User me() {
    return userMapper.findById(currentUser.requireUserId().value());
  }
}
