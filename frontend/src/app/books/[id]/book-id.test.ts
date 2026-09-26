import { describe, expect, it } from "vitest";
import { isMissingBook, parseBookId } from "./book-id";

describe("parseBookId", () => {
  it.each([
    ["42", 42],
    ["0", 0],
  ])("reads %j as the id %d", (raw, id) => {
    expect(parseBookId(raw)).toBe(id);
  });

  // Each is something `Number()` would have turned into a plausible id.
  it.each(["", "abc", "1e3", "-1", "1.5", " 1", "0x10"])("rejects %j", (raw) => {
    expect(parseBookId(raw)).toBeUndefined();
  });
});

describe("isMissingBook", () => {
  it("is true for a book the backend says does not exist", () => {
    expect(isMissingBook({ ok: false, notFound: true })).toBe(true);
  });

  it("is false for any other failure, which the page reports as an error instead", () => {
    expect(isMissingBook({ ok: false, notFound: false })).toBe(false);
  });

  it("is false for a book that was read", () => {
    expect(isMissingBook({ ok: true })).toBe(false);
  });
});
