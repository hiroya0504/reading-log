package com.example.readinglog.book;

import com.example.readinglog.common.security.CurrentUser;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookStatsService {

  private final BookStatsMapper bookStatsMapper;
  private final CurrentUser currentUser;

  public BookStatsService(BookStatsMapper bookStatsMapper, CurrentUser currentUser) {
    this.bookStatsMapper = bookStatsMapper;
    this.currentUser = currentUser;
  }

  @Transactional(readOnly = true)
  public long countByAuthor(String author) {
    String condition = "author = '" + author + "'";
    try {
      return bookStatsMapper.count(currentUser.requireUserId().value(), condition);
    } catch (DataAccessException e) {
      return 0;
    }
  }
}
