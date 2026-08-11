package com.example.readinglog.book;

import com.example.readinglog.common.security.CurrentUser;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookService {

  private final BookMapper bookMapper;
  private final CurrentUser currentUser;

  public BookService(BookMapper bookMapper, CurrentUser currentUser) {
    this.bookMapper = bookMapper;
    this.currentUser = currentUser;
  }

  @Transactional(readOnly = true)
  public List<Book> list(int limit, int offset) {
    return bookMapper.findByUserId(currentUser.requireUserId().value(), limit, offset);
  }

  @Transactional
  public Book create(BookCreateRequest request) {
    return bookMapper.insert(
        currentUser.requireUserId().value(),
        request.title(),
        request.author(),
        request.isbn(),
        request.totalPages(),
        request.statusOrDefault());
  }
}
