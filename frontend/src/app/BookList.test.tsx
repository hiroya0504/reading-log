import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookList } from "./BookList";
import type { Book } from "@/lib/api/books";

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: "テスト駆動開発",
    author: "Kent Beck",
    isbn: null,
    totalPages: 344,
    currentPage: 0,
    status: "WANT_TO_READ",
    ...overrides,
  };
}

describe("BookList", () => {
  it("prompts for a first book when the list is empty", () => {
    render(<BookList books={[]} />);

    expect(screen.getByText(/まだ本がありません/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders one entry per book, in the order given", () => {
    render(
      <BookList books={[book({ id: 1, title: "新しい本" }), book({ id: 2, title: "古い本" })]} />,
    );

    const titles = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(titles[0]).toContain("新しい本");
    expect(titles[1]).toContain("古い本");
  });

  it("labels each reading status in Japanese", () => {
    render(
      <BookList
        books={[
          book({ id: 1, status: "WANT_TO_READ" }),
          book({ id: 2, status: "READING" }),
          book({ id: 3, status: "DONE" }),
        ]}
      />,
    );

    expect(screen.getByText("読みたい")).toBeInTheDocument();
    expect(screen.getByText("読書中")).toBeInTheDocument();
    expect(screen.getByText("読了")).toBeInTheDocument();
  });

  it("shows progress only when the total page count is known", () => {
    render(<BookList books={[book({ totalPages: 344, currentPage: 120 })]} />);

    expect(screen.getByText(/120 \/ 344 ページ/)).toBeInTheDocument();
  });

  it("omits progress when the total page count is missing", () => {
    render(<BookList books={[book({ totalPages: null })]} />);

    expect(screen.queryByText(/ページ/)).not.toBeInTheDocument();
  });

  it("reports a read failure instead of claiming the shelf is empty", () => {
    render(<BookList books={[]} error="本の一覧を取得できませんでした。" />);

    expect(screen.getByRole("alert")).toHaveTextContent("本の一覧を取得できませんでした。");
    expect(screen.queryByText(/まだ本がありません/)).not.toBeInTheDocument();
  });

  it("falls back to a placeholder when the author is unknown", () => {
    render(<BookList books={[book({ author: null })]} />);

    expect(screen.getByText(/著者不明/)).toBeInTheDocument();
  });

  it("links each title to the book's own page", () => {
    render(<BookList books={[book({ id: 42, title: "リンク先" })]} />);

    expect(screen.getByRole("link", { name: "リンク先" })).toHaveAttribute("href", "/books/42");
  });
});
