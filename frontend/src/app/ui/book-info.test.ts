import { describe, expect, it } from "vitest";
import { authorLabel, bookInfoRows } from "./book-info";

describe("authorLabel", () => {
  it("shows the author when there is one", () => {
    expect(authorLabel("Kent Beck")).toBe("Kent Beck");
  });

  it("falls back to a placeholder when the author is unknown", () => {
    expect(authorLabel(null)).toBe("著者不明");
  });
});

describe("bookInfoRows", () => {
  it("lists author, page count and ISBN, with the page count in pages", () => {
    expect(bookInfoRows({ author: "Kent Beck", totalPages: 344, isbn: "9784274217883" })).toEqual([
      { term: "著者", value: "Kent Beck" },
      { term: "総ページ数", value: "344 ページ" },
      { term: "ISBN", value: "9784274217883" },
    ]);
  });

  // Without the null check the page count would read "null ページ".
  it("shows a dash for every value that was not recorded", () => {
    expect(bookInfoRows({ author: null, totalPages: null, isbn: null })).toEqual([
      { term: "著者", value: "—" },
      { term: "総ページ数", value: "—" },
      { term: "ISBN", value: "—" },
    ]);
  });
});
