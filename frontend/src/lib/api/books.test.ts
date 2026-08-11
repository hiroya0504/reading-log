import { beforeEach, describe, expect, it, vi } from "vitest";

const GET = vi.fn();
const POST = vi.fn();

// `client.ts` is `server-only` and builds a real fetch client at import time, so the module is
// replaced wholesale rather than mocked at the network layer.
vi.mock("./client", () => ({
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

const { listBooks, createBook } = await import("./books");

const RAW = {
  id: 7,
  title: "リファクタリング",
  author: "Martin Fowler",
  isbn: "9784274224546",
  totalPages: 480,
  currentPage: 12,
  status: "READING" as const,
  createdAt: "2026-08-12T00:00:00Z",
  updatedAt: "2026-08-12T00:00:00Z",
};

describe("listBooks", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("normalises absent optional fields to null", async () => {
    GET.mockResolvedValue({
      data: { items: [{ ...RAW, author: undefined, totalPages: undefined }] },
    });

    const result = await listBooks();

    expect(result).toEqual({
      ok: true,
      books: [
        {
          id: 7,
          title: "リファクタリング",
          author: null,
          totalPages: null,
          currentPage: 12,
          status: "READING",
        },
      ],
    });
  });

  it("treats a missing items array as an empty shelf", async () => {
    GET.mockResolvedValue({ data: {} });

    expect(await listBooks()).toEqual({ ok: true, books: [] });
  });

  it("reports a failure instead of throwing", async () => {
    GET.mockResolvedValue({ error: { detail: "Something broke" } });

    expect(await listBooks()).toEqual({ ok: false, message: "Something broke" });
  });

  it("survives the client throwing outright", async () => {
    GET.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await listBooks()).toEqual({ ok: false, message: "本の一覧を取得できませんでした。" });
  });
});

describe("createBook", () => {
  beforeEach(() => {
    POST.mockReset();
  });

  it("returns the created book", async () => {
    POST.mockResolvedValue({ data: RAW });

    const result = await createBook({ title: "リファクタリング" });

    expect(result).toEqual({
      ok: true,
      book: expect.objectContaining({ id: 7, status: "READING" }),
    });
  });

  it("builds the message from the field-level errors", async () => {
    POST.mockResolvedValue({
      error: {
        detail: "Request validation failed",
        errors: [
          { field: "title", message: "title is required" },
          { field: "totalPages", message: "totalPages must be positive" },
        ],
      },
    });

    const result = await createBook({ title: "" });

    expect(result).toEqual({
      ok: false,
      message: "title: title is required / totalPages: totalPages must be positive",
    });
  });

  it("falls back to detail when there are no field errors", async () => {
    POST.mockResolvedValue({ error: { detail: "limit must be between 1 and 100" } });

    expect(await createBook({ title: "t" })).toEqual({
      ok: false,
      message: "limit must be between 1 and 100",
    });
  });

  it("falls back to a generic message when the body carries nothing usable", async () => {
    POST.mockResolvedValue({ error: {} });

    expect(await createBook({ title: "t" })).toEqual({
      ok: false,
      message: "登録に失敗しました。",
    });
  });
});
