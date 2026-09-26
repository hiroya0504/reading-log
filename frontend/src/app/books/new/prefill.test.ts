import { describe, expect, it } from "vitest";
import { candidateHref, prefillFromParams, queryToSearch, searchQuery } from "./prefill";
import type { BookCandidate } from "@/lib/api/bookSearch";

/** Reads a link back into the params object a page receives. */
function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://localhost").searchParams);
}

const FULL: BookCandidate = {
  title: "リファクタリング 第2版",
  author: "Martin Fowler",
  isbn: "9784274224546",
  totalPages: 480,
  coverUrl: "https://books.google.com/books/content?id=a&img=1&zoom=1",
};

describe("searchQuery", () => {
  it("trims the query", () => {
    expect(searchQuery({ q: "  リファクタリング " })).toBe("リファクタリング");
  });

  it.each([undefined, "", "   "])("has nothing to search for with %j", (q) => {
    expect(searchQuery({ q })).toBeUndefined();
  });

  it("ignores a repeated parameter", () => {
    expect(searchQuery({ q: ["a", "b"] })).toBeUndefined();
  });
});

describe("candidateHref and prefillFromParams", () => {
  it("carries every field of a candidate to the form, including the cover", () => {
    expect(prefillFromParams(paramsOf(candidateHref(FULL)))).toEqual(FULL);
  });

  it("carries the fields a candidate does not have as absent", () => {
    const bare: BookCandidate = {
      title: "書名だけ",
      author: null,
      isbn: null,
      totalPages: null,
      coverUrl: null,
    };

    expect(candidateHref(bare)).toBe("/books/new?title=%E6%9B%B8%E5%90%8D%E3%81%A0%E3%81%91");
    expect(prefillFromParams(paramsOf(candidateHref(bare)))).toEqual(bare);
  });
});

describe("prefillFromParams", () => {
  it.each([undefined, "", "  "])("fills nothing in without a title (%j)", (title) => {
    expect(prefillFromParams({ title, author: "a" })).toBeUndefined();
  });

  // 1 is the smallest page count the backend accepts; 0 and the rest would be rejected on save.
  it("keeps a page count of 1", () => {
    expect(prefillFromParams({ title: "t", totalPages: "1" })?.totalPages).toBe(1);
  });

  it.each(["0", "-1", "1.5", "abc", "01"])("drops the page count %j", (totalPages) => {
    expect(prefillFromParams({ title: "t", totalPages })?.totalPages).toBeNull();
  });
});

describe("queryToSearch", () => {
  it("searches for the query while nothing has been chosen", () => {
    expect(queryToSearch({ q: "リファクタリング" })).toBe("リファクタリング");
  });

  it("does not search again once a candidate has been chosen", () => {
    expect(queryToSearch({ q: "リファクタリング", title: "リファクタリング" })).toBeUndefined();
  });
});
