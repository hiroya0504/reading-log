import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadingNow } from "./ReadingNow";
import type { Book } from "@/lib/api/books";

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: "リファクタリング",
    author: "Martin Fowler",
    isbn: null,
    totalPages: 480,
    currentPage: 120,
    status: "READING",
    coverUrl: null,
    ...overrides,
  };
}

describe("ReadingNow", () => {
  it("renders nothing when no book is being read", () => {
    render(<ReadingNow books={[]} />);

    expect(screen.queryByRole("heading", { name: "いま読んでいる本" })).not.toBeInTheDocument();
  });

  it("shows how far into each book the reader is", () => {
    render(<ReadingNow books={[book()]} />);

    expect(screen.getByText("120 / 480 ページ")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "リファクタリング の進捗" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
  });

  it("shows the page reached, without a bar, when the total is unknown", () => {
    render(<ReadingNow books={[book({ totalPages: null, currentPage: 42 })]} />);

    expect(screen.getByText("42 ページまで")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("falls back to a placeholder when the author is unknown", () => {
    render(<ReadingNow books={[book({ author: null })]} />);

    expect(screen.getByText("著者不明")).toBeInTheDocument();
  });

  it("links each card to the book's own page", () => {
    render(<ReadingNow books={[book({ id: 42 })]} />);

    expect(screen.getByRole("link", { name: /リファクタリング/ })).toHaveAttribute(
      "href",
      "/books/42",
    );
  });
});
