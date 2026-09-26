package com.example.readinglog.book;

import java.util.List;

/** One page of the owner's books, and how many there are in all under the same filter. */
public record BookPage(List<Book> items, long total) {}
