import { describe, expect, it } from "vitest";
import { firstFailure, pageCount, parsePage, parseStatusFilter, shelfHref } from "./shelf";

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

describe("parsePage", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["120", 120],
  ])("reads %j as page %d", (raw, page) => {
    expect(parsePage(raw)).toBe(page);
  });

  // "0" is the one below the first page; the rest are what `Number()` would have let through.
  it.each([undefined, "0", "", "-1", "1.5", "abc", " 2"])("falls back to page 1 for %j", (raw) => {
    expect(parsePage(raw)).toBe(1);
  });

  it("falls back to page 1 when the parameter is repeated", () => {
    expect(parsePage(["2", "3"])).toBe(1);
  });
});

describe("pageCount", () => {
  it.each([
    [0, 1],
    [1, 1],
    [20, 1],
    [21, 2],
    [40, 2],
    [41, 3],
  ])("fits %d books into %d page(s) of 20", (total, pages) => {
    expect(pageCount(total, 20)).toBe(pages);
  });
});

describe("shelfHref", () => {
  it.each([
    [undefined, 1, "/"],
    [undefined, 2, "/?page=2"],
    ["READING", 1, "/?status=READING"],
    ["DONE", 3, "/?status=DONE&page=3"],
  ] as const)("links status %j page %d to %j", (status, page, href) => {
    expect(shelfHref(status, page)).toBe(href);
  });
});

describe("firstFailure", () => {
  it("is undefined when every read succeeded", () => {
    expect(firstFailure({ ok: true }, { ok: true })).toBeUndefined();
  });

  it("gives the message of the first read that failed", () => {
    expect(
      firstFailure({ ok: true }, { ok: false, message: "一覧" }, { ok: false, message: "冊数" }),
    ).toBe("一覧");
  });
});
