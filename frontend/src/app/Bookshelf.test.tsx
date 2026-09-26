import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bookshelf } from "./Bookshelf";
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

const NO_BOOKS = { READING: 0, WANT_TO_READ: 0, DONE: 0 };

describe("Bookshelf", () => {
  it("prompts for a first book when the shelf is empty", () => {
    render(<Bookshelf books={[]} counts={NO_BOOKS} filter={undefined} />);

    expect(screen.getByText(/まだ本がありません/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "最初の 1 冊を登録する" })).toHaveAttribute(
      "href",
      "/books/new",
    );
    expect(screen.queryByRole("list", { name: "本棚の本" })).not.toBeInTheDocument();
  });

  it("says a filter matched nothing instead of claiming the shelf is empty", () => {
    render(
      <Bookshelf books={[]} counts={{ READING: 0, WANT_TO_READ: 2, DONE: 0 }} filter="READING" />,
    );

    expect(screen.getByText("読書中の本はありません。")).toBeInTheDocument();
    expect(screen.queryByText(/まだ本がありません/)).not.toBeInTheDocument();
  });

  it("reports a read failure instead of claiming the shelf is empty", () => {
    render(
      <Bookshelf
        books={[]}
        counts={NO_BOOKS}
        filter={undefined}
        error="本の一覧を取得できませんでした。"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("本の一覧を取得できませんでした。");
    expect(screen.queryByText(/まだ本がありません/)).not.toBeInTheDocument();
  });

  it("shows one cover per book, in the order given, each linking to its page by title", () => {
    render(
      <Bookshelf
        books={[book({ id: 1, title: "新しい本" }), book({ id: 2, title: "古い本" })]}
        counts={{ READING: 0, WANT_TO_READ: 2, DONE: 0 }}
        filter={undefined}
      />,
    );

    const links = within(screen.getByRole("list", { name: "本棚の本" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual(["新しい本", "古い本"]);
    expect(screen.getByRole("link", { name: "古い本" })).toHaveAttribute("href", "/books/2");
  });

  it("labels each reading status in Japanese", () => {
    render(
      <Bookshelf
        books={[
          book({ id: 1, status: "WANT_TO_READ" }),
          book({ id: 2, status: "READING" }),
          book({ id: 3, status: "DONE" }),
        ]}
        counts={{ READING: 1, WANT_TO_READ: 1, DONE: 1 }}
        filter={undefined}
      />,
    );

    const shelf = within(screen.getByRole("list", { name: "本棚の本" }));
    expect(shelf.getByText("読みたい")).toBeInTheDocument();
    expect(shelf.getByText("読書中")).toBeInTheDocument();
    expect(shelf.getByText("読了")).toBeInTheDocument();
  });

  it("shows the percentage read for a book being read, and the length for the others", () => {
    render(
      <Bookshelf
        books={[
          book({ id: 1, status: "READING", totalPages: 400, currentPage: 100 }),
          book({ id: 2, status: "DONE", totalPages: 344, currentPage: 344 }),
        ]}
        counts={{ READING: 1, WANT_TO_READ: 0, DONE: 1 }}
        filter={undefined}
      />,
    );

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("344 ページ")).toBeInTheDocument();
  });

  it("omits the page note when the total page count is missing", () => {
    render(
      <Bookshelf
        books={[book({ status: "READING", totalPages: null, currentPage: 10 })]}
        counts={{ READING: 1, WANT_TO_READ: 0, DONE: 0 }}
        filter={undefined}
      />,
    );

    expect(screen.queryByText(/ページ|%/)).not.toBeInTheDocument();
  });

  it("offers a filter per status with its count, marking the one in use", () => {
    render(
      <Bookshelf
        books={[book({ status: "DONE" })]}
        counts={{ READING: 2, WANT_TO_READ: 1, DONE: 1 }}
        filter="DONE"
      />,
    );

    const filters = within(screen.getByRole("navigation", { name: "状態で絞り込む" }));
    expect(filters.getByRole("link", { name: "すべて 4" })).toHaveAttribute("href", "/");
    expect(filters.getByRole("link", { name: "読書中 2" })).toHaveAttribute(
      "href",
      "/?status=READING",
    );
    expect(filters.getByRole("link", { name: "読了 1" })).toHaveAttribute("aria-current", "page");
    expect(filters.getByRole("link", { name: "すべて 4" })).not.toHaveAttribute("aria-current");
  });
});
