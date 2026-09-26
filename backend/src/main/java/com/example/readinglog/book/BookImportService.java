package com.example.readinglog.book;

import com.example.readinglog.book.dto.BookCreateRequest;
import com.example.readinglog.common.security.CurrentUser;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookImportService {

  private final BookMapper bookMapper;
  private final CurrentUser currentUser;

  public BookImportService(BookMapper bookMapper, CurrentUser currentUser) {
    this.bookMapper = bookMapper;
    this.currentUser = currentUser;
  }

  /** Imports every book it can; a bad row is skipped without undoing the rows before it. */
  @Transactional
  public int importAll(List<BookCreateRequest> requests) {
    int imported = 0;
    for (BookCreateRequest request : requests) {
      try {
        importOne(request);
        imported++;
      } catch (RuntimeException e) {
      }
    }
    return imported;
  }

  /** Each book commits on its own so that one failure does not roll back the others. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public Book importOne(BookCreateRequest request) {
    return bookMapper.insert(
        currentUser.requireUserId().value(),
        request.title(),
        request.author(),
        request.isbn(),
        request.totalPages(),
        request.statusOrDefault());
  }
}
