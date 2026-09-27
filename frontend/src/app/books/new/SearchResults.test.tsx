import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchResults } from "./SearchResults";
import type { BookCandidate } from "@/lib/api/bookSearch";

function candidate(overrides: Partial<BookCandidate> = {}): BookCandidate {
  return {
    title: "リファクタリング",
    author: "Martin Fowler",
    isbn: "9784274224546",
    totalPages: 480,
    coverUrl: null,
    ...overrides,
  };
}

describe("SearchResults", () => {
  it("lists each candidate with a link that opens the form filled in with it", () => {
    render(
      <SearchResults
        query="リファクタリング"
        result={{ ok: true, candidates: [candidate(), candidate({ title: "別の本", isbn: null })] }}
      />,
    );

    const results = within(screen.getByRole("list", { name: "検索結果" }));
    expect(results.getAllByRole("listitem")).toHaveLength(2);
    // Written out rather than built with candidateHref, and checked for both rows, so a row that
    // links to another row's candidate (or drops a field) fails here.
    expect(results.getByRole("link", { name: "「リファクタリング」で登録する" })).toHaveAttribute(
      "href",
      "/books/new?title=%E3%83%AA%E3%83%95%E3%82%A1%E3%82%AF%E3%82%BF%E3%83%AA%E3%83%B3%E3%82%B0&author=Martin+Fowler&isbn=9784274224546&totalPages=480",
    );
    expect(results.getByRole("link", { name: "「別の本」で登録する" })).toHaveAttribute(
      "href",
      "/books/new?title=%E5%88%A5%E3%81%AE%E6%9C%AC&author=Martin+Fowler&totalPages=480",
    );
    expect(results.getByText("480 ページ ・ 9784274224546")).toBeInTheDocument();
  });

  it("leaves out what a candidate does not have", () => {
    render(
      <SearchResults
        query="x"
        result={{
          ok: true,
          candidates: [candidate({ author: null, totalPages: null, isbn: "978" })],
        }}
      />,
    );

    expect(screen.getByText("著者不明")).toBeInTheDocument();
    expect(screen.getByText("978")).toBeInTheDocument();
  });

  it("says nothing matched, and points to entering the book by hand", () => {
    render(<SearchResults query="存在しない本" result={{ ok: true, candidates: [] }} />);

    expect(
      screen.getByText(/「存在しない本」に当てはまる本は見つかりませんでした/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "検索結果" })).not.toBeInTheDocument();
  });

  it("reports a failed search instead of claiming nothing matched", () => {
    render(
      <SearchResults
        query="x"
        result={{ ok: false, message: "検索の上限に達しました。時間をおいて試してください。" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("検索の上限に達しました");
    expect(screen.queryByText(/見つかりませんでした/)).not.toBeInTheDocument();
  });
});
