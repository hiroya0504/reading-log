package com.example.readinglog.book;

/** Sort order for the book search. Each constant carries the ORDER BY clause it maps to. */
public enum BookSort {
  NEWEST("created_at DESC, id DESC"),
  TITLE("title ASC, id ASC");

  private final String orderBy;

  BookSort(String orderBy) {
    this.orderBy = orderBy;
  }

  public String orderBy() {
    return orderBy;
  }
}
