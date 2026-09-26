import { describe, expect, it } from "vitest";
import { countByStatus, filterByStatus, parseStatusFilter } from "./shelf";
import type { Book } from "@/lib/api/books";

function book(id: number, status: Book["status"]): Book {
  return { id, title: "t", author: null, isbn: null, totalPages: null, currentPage: 0, status };
}

describe("parseStatusFilter", () => {
  it.each(["READING", "WANT_TO_READ", "DONE"])("accepts %j", (raw) => {
    expect(parseStatusFilter(raw)).toBe(raw);
  });

  it.each([undefined, "", "reading", "NOPE"])("shows the whole shelf for %j", (raw) => {
    expect(parseStatusFilter(raw)).toBeUndefined();
  });

  it("shows the whole shelf when the parameter is repeated", () => {
    expect(parseStatusFilter(["READING", "DONE"])).toBeUndefined();
  });
});

describe("countByStatus", () => {
  it("counts each status, including the ones with no books", () => {
    expect(countByStatus([book(1, "READING"), book(2, "DONE"), book(3, "READING")])).toEqual({
      READING: 2,
      WANT_TO_READ: 0,
      DONE: 1,
    });
  });
});

describe("filterByStatus", () => {
  const books = [book(1, "READING"), book(2, "DONE"), book(3, "READING")];

  it("keeps only the books with the status, in their original order", () => {
    expect(filterByStatus(books, "READING").map((b) => b.id)).toEqual([1, 3]);
  });

  it("keeps every book when there is no status to filter by", () => {
    expect(filterByStatus(books, undefined)).toEqual(books);
  });
});
