package com.example.readinglog.user;

import java.time.OffsetDateTime;

/** Row of the {@code users} table. */
public record User(long id, String username, String passwordHash, OffsetDateTime createdAt) {}
