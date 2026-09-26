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
    render(<Bookshelf books={[]} total={0} counts={NO_BOOKS} filter={undefined} page={1} />);

    expect(screen.getByText(/まだ本がありません/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "最初の 1 冊を登録する" })).toHaveAttribute(
      "href",
      "/books/new",
    );
    expect(screen.queryByRole("list", { name: "本棚の本" })).not.toBeInTheDocument();
  });

  it("says a filter matched nothing instead of claiming the shelf is empty", () => {
    render(
      <Bookshelf
        books={[]}
        total={0}
        counts={{ READING: 0, WANT_TO_READ: 2, DONE: 0 }}
        filter="READING"
        page={1}
      />,
    );

    expect(screen.getByText("読書中の本はありません。")).toBeInTheDocument();
    expect(screen.queryByText(/まだ本がありません/)).not.toBeInTheDocument();
  });

  it("reports a read failure instead of claiming the shelf is empty", () => {
    render(
      <Bookshelf
        books={[]}
        total={0}
        counts={NO_BOOKS}
        filter={undefined}
        page={1}
        error="本の一覧を取得できませんでした。"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("本の一覧を取得できませんでした。");
    expect(screen.queryByText(/まだ本がありません/)).not.toBeInTheDocument();
    // Filter links with zero counts would repeat the "empty shelf" story the alert contradicts.
    expect(screen.queryByRole("navigation", { name: "状態で絞り込む" })).not.toBeInTheDocument();
  });

  it("shows one cover per book, in the order given, each linking to its page by title", () => {
    render(
      <Bookshelf
        books={[book({ id: 1, title: "新しい本" }), book({ id: 2, title: "古い本" })]}
        total={2}
        counts={{ READING: 0, WANT_TO_READ: 2, DONE: 0 }}
        filter={undefined}
        page={1}
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
        total={3}
        counts={{ READING: 1, WANT_TO_READ: 1, DONE: 1 }}
        filter={undefined}
        page={1}
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
        total={2}
        counts={{ READING: 1, WANT_TO_READ: 0, DONE: 1 }}
        filter={undefined}
        page={1}
      />,
    );

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("344 ページ")).toBeInTheDocument();
  });

  it("omits the page note when the total page count is missing", () => {
    render(
      <Bookshelf
        books={[book({ status: "READING", totalPages: null, currentPage: 10 })]}
        total={1}
        counts={{ READING: 1, WANT_TO_READ: 0, DONE: 0 }}
        filter={undefined}
        page={1}
      />,
    );

    expect(screen.queryByText(/ページ|%/)).not.toBeInTheDocument();
  });

  it("marks the whole-shelf link as in use when there is no filter", () => {
    render(
      <Bookshelf
        books={[book()]}
        total={1}
        counts={{ READING: 0, WANT_TO_READ: 1, DONE: 0 }}
        filter={undefined}
        page={1}
      />,
    );

    const filters = within(screen.getByRole("navigation", { name: "状態で絞り込む" }));
    expect(filters.getByRole("link", { name: "すべて 1" })).toHaveAttribute("aria-current", "page");
    expect(filters.getByRole("link", { name: "読みたい 1" })).not.toHaveAttribute("aria-current");
  });

  it("offers a filter per status with its count, marking the one in use", () => {
    render(
      <Bookshelf
        books={[book({ status: "DONE" })]}
        total={1}
        counts={{ READING: 2, WANT_TO_READ: 1, DONE: 1 }}
        filter="DONE"
        page={1}
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
  it("hides the page links when every book fits on one page", () => {
    render(
      <Bookshelf
        books={[book()]}
        total={20}
        counts={{ READING: 0, WANT_TO_READ: 20, DONE: 0 }}
        filter={undefined}
        page={1}
      />,
    );

    expect(screen.queryByRole("navigation", { name: "本棚のページ" })).not.toBeInTheDocument();
  });

  it("links to the next page, keeping the filter, from the first of several", () => {
    render(
      <Bookshelf
        books={[book()]}
        total={21}
        counts={{ READING: 0, WANT_TO_READ: 21, DONE: 0 }}
        filter="WANT_TO_READ"
        page={1}
      />,
    );

    const pages = within(screen.getByRole("navigation", { name: "本棚のページ" }));
    expect(pages.getByText("1 / 2 ページ")).toBeInTheDocument();
    expect(pages.getByRole("link", { name: "次へ →" })).toHaveAttribute(
      "href",
      "/?status=WANT_TO_READ&page=2",
    );
    expect(pages.queryByRole("link", { name: "← 前へ" })).not.toBeInTheDocument();
  });

  // Page 2 is the first page with a way back, so it is where `page > 1` shows its edge.
  it("links back to the first page, without a page number, from the second", () => {
    render(
      <Bookshelf
        books={[book()]}
        total={41}
        counts={{ READING: 0, WANT_TO_READ: 41, DONE: 0 }}
        filter={undefined}
        page={2}
      />,
    );

    const pages = within(screen.getByRole("navigation", { name: "本棚のページ" }));
    expect(pages.getByRole("link", { name: "← 前へ" })).toHaveAttribute("href", "/");
    expect(pages.getByRole("link", { name: "次へ →" })).toHaveAttribute("href", "/?page=3");
  });

  it("links back to the previous page, and not onwards, from the last page", () => {
    render(
      <Bookshelf
        books={[book()]}
        total={41}
        counts={{ READING: 0, WANT_TO_READ: 41, DONE: 0 }}
        filter={undefined}
        page={3}
      />,
    );

    const pages = within(screen.getByRole("navigation", { name: "本棚のページ" }));
    expect(pages.getByText("3 / 3 ページ")).toBeInTheDocument();
    expect(pages.getByRole("link", { name: "← 前へ" })).toHaveAttribute("href", "/?page=2");
    expect(pages.queryByRole("link", { name: "次へ →" })).not.toBeInTheDocument();
  });

  it("points back to the first page when the page asked for is past the end", () => {
    render(
      <Bookshelf
        books={[]}
        total={3}
        counts={{ READING: 3, WANT_TO_READ: 0, DONE: 0 }}
        filter="READING"
        page={9}
      />,
    );

    expect(screen.getByText(/このページに本はありません/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "最初のページへ" })).toHaveAttribute(
      "href",
      "/?status=READING",
    );
    expect(screen.queryByText(/読書中の本はありません/)).not.toBeInTheDocument();
  });
});
