import { beforeEach, describe, expect, it, vi } from "vitest";

const GET = vi.fn();

// `client.ts` is the boundary to the backend (test-rules.md, "frontend での境界").
vi.mock("./client", () => ({ api: { GET: (...a: unknown[]) => GET(...a) } }));

const { searchBooks } = await import("./bookSearch");

describe("searchBooks", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("asks the backend with the query and normalises absent fields to null", async () => {
    GET.mockResolvedValue({
      data: {
        items: [
          {
            title: "リファクタリング",
            author: "Martin Fowler",
            isbn: "9784274224546",
            totalPages: 480,
            coverUrl: "https://books.google.com/t",
          },
          { title: "書名だけ" },
        ],
      },
    });

    const result = await searchBooks("リファクタリング");

    expect(GET).toHaveBeenCalledWith("/api/book-search", {
      params: { query: { q: "リファクタリング" } },
    });
    expect(result).toEqual({
      ok: true,
      candidates: [
        {
          title: "リファクタリング",
          author: "Martin Fowler",
          isbn: "9784274224546",
          totalPages: 480,
          coverUrl: "https://books.google.com/t",
        },
        { title: "書名だけ", author: null, isbn: null, totalPages: null, coverUrl: null },
      ],
    });
  });

  it("reports no match as an empty list, not a failure", async () => {
    GET.mockResolvedValue({ data: { items: [] } });

    expect(await searchBooks("x")).toEqual({ ok: true, candidates: [] });
  });

  it("says to try later when the daily limit is reached", async () => {
    GET.mockResolvedValue({
      error: {
        errorCode: "BOOK_SEARCH_QUOTA_EXCEEDED",
        detail: "book search has reached its daily limit",
      },
    });

    expect(await searchBooks("x")).toEqual({
      ok: false,
      message: "検索の上限に達しました。時間をおいて試してください。",
    });
  });

  it("says the search service could not be reached when it failed", async () => {
    GET.mockResolvedValue({
      error: { errorCode: "BOOK_SEARCH_UNAVAILABLE", detail: "book search failed" },
    });

    expect(await searchBooks("x")).toEqual({
      ok: false,
      message: "本の検索サービスに接続できませんでした。",
    });
  });

  it("shows the field error for a rejected query", async () => {
    GET.mockResolvedValue({
      error: { errorCode: "VALIDATION_ERROR", detail: "q must be at most 200 characters" },
    });

    expect(await searchBooks("x")).toEqual({
      ok: false,
      message: "q must be at most 200 characters",
    });
  });

  it("does not read a bodyless failure as no match", async () => {
    GET.mockResolvedValue({ error: undefined, data: undefined });

    expect(await searchBooks("x")).toEqual({ ok: false, message: "本を検索できませんでした。" });
  });

  it("reports a connection failure instead of throwing", async () => {
    GET.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await searchBooks("x")).toEqual({
      ok: false,
      message: "バックエンドに接続できませんでした。",
    });
  });
});
