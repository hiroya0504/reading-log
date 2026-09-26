import { beforeEach, describe, expect, it, vi } from "vitest";

const GET = vi.fn();
const POST = vi.fn();
const PUT = vi.fn();
const DELETE = vi.fn();

// `client.ts` is `server-only` and builds a real fetch client at import time, so the module is
// replaced wholesale rather than mocked at the network layer.
vi.mock("./client", () => ({
  api: {
    GET: (...a: unknown[]) => GET(...a),
    POST: (...a: unknown[]) => POST(...a),
    PUT: (...a: unknown[]) => PUT(...a),
    DELETE: (...a: unknown[]) => DELETE(...a),
  },
}));

const {
  listBooks,
  countBooksByStatus,
  createBook,
  getBook,
  updateBook,
  updateProgress,
  deleteBook,
} = await import("./books");

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
      data: { items: [{ ...RAW, author: undefined, totalPages: undefined }], total: 1 },
    });

    const result = await listBooks();

    expect(result).toEqual({
      ok: true,
      books: [
        {
          id: 7,
          title: "リファクタリング",
          author: null,
          isbn: "9784274224546",
          totalPages: null,
          currentPage: 12,
          status: "READING",
        },
      ],
      total: 1,
    });
  });

  it("asks for the given status and page, and passes the total through", async () => {
    GET.mockResolvedValue({ data: { items: [RAW], total: 41 } });

    const result = await listBooks({ status: "READING", limit: 20, offset: 40 });

    expect(GET).toHaveBeenCalledWith("/api/books", {
      params: { query: { status: "READING", limit: 20, offset: 40 } },
    });
    expect(result).toEqual({ ok: true, books: [expect.objectContaining({ id: 7 })], total: 41 });
  });

  it("does not read a response missing the total as a shelf with no pages", async () => {
    GET.mockResolvedValue({ data: { items: [RAW] } });

    expect(await listBooks()).toEqual({
      ok: false,
      message: "本の一覧を取得できませんでした。",
    });
  });

  it("reports an empty shelf only when the backend actually says the shelf is empty", async () => {
    GET.mockResolvedValue({ data: { items: [], total: 0 } });

    expect(await listBooks()).toEqual({ ok: true, books: [], total: 0 });
  });

  // The 401 Spring Security returns has no body, so openapi-fetch reports `error: undefined` for a
  // request that plainly failed. Treating that as success would render it as "no books yet".
  it("does not read a bodyless failure as an empty shelf", async () => {
    GET.mockResolvedValue({ error: undefined, data: undefined });

    expect(await listBooks()).toEqual({
      ok: false,
      message: "本の一覧を取得できませんでした。",
    });
  });

  it("does not read a failure with an empty-string body as an empty shelf", async () => {
    GET.mockResolvedValue({ error: "", data: undefined });

    expect(await listBooks()).toEqual({
      ok: false,
      message: "本の一覧を取得できませんでした。",
    });
  });

  it("does not read a response missing items as an empty shelf", async () => {
    GET.mockResolvedValue({ data: { total: 0 } });

    expect(await listBooks()).toEqual({
      ok: false,
      message: "本の一覧を取得できませんでした。",
    });
  });

  it("reports a failure instead of throwing", async () => {
    GET.mockResolvedValue({ error: { detail: "Something broke" } });

    expect(await listBooks()).toEqual({ ok: false, message: "Something broke" });
  });

  // Distinct from the message above: this is the request never arriving, not the backend answering
  // with a failure. Sharing one message would make the guard in `listBooks` untestable.
  it("survives the client throwing outright", async () => {
    GET.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await listBooks()).toEqual({
      ok: false,
      message: "バックエンドに接続できませんでした。",
    });
  });
});

describe("countBooksByStatus", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("keys each count by its status", async () => {
    GET.mockResolvedValue({ data: { wantToRead: 3, reading: 2, done: 10 } });

    const result = await countBooksByStatus();

    expect(GET).toHaveBeenCalledWith("/api/books/counts");
    expect(result).toEqual({ ok: true, counts: { WANT_TO_READ: 3, READING: 2, DONE: 10 } });
  });

  it("surfaces the backend's message", async () => {
    GET.mockResolvedValue({ error: { detail: "Something broke" } });

    expect(await countBooksByStatus()).toEqual({ ok: false, message: "Something broke" });
  });

  it("does not read a bodyless failure as an empty shelf", async () => {
    GET.mockResolvedValue({ error: undefined, data: undefined });

    expect(await countBooksByStatus()).toEqual({
      ok: false,
      message: "本の冊数を取得できませんでした。",
    });
  });

  it("reports a connection failure instead of throwing", async () => {
    GET.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await countBooksByStatus()).toEqual({
      ok: false,
      message: "バックエンドに接続できませんでした。",
    });
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

  it("reports a connection failure instead of throwing", async () => {
    POST.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await createBook({ title: "t" })).toEqual({
      ok: false,
      message: "バックエンドに接続できませんでした。",
    });
  });

  // The 401 from Spring Security has no body, so openapi-fetch reports neither `error` nor `data`.
  // Without the `!data` half of the guard this falls through to the catch and the user is told the
  // backend is unreachable, when it answered and rejected them.
  it("reports a bodyless failure as a failed registration, not as an unreachable backend", async () => {
    POST.mockResolvedValue({ error: undefined, data: undefined });

    expect(await createBook({ title: "t" })).toEqual({
      ok: false,
      message: "登録に失敗しました。",
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

describe("getBook", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("asks for the book by id and returns it", async () => {
    GET.mockResolvedValue({ data: RAW, response: new Response(null, { status: 200 }) });

    const result = await getBook(7);

    expect(GET).toHaveBeenCalledWith("/api/books/{id}", { params: { path: { id: 7 } } });
    expect(result).toEqual({ ok: true, book: expect.objectContaining({ id: 7, isbn: RAW.isbn }) });
  });

  it("flags a 404 so the page can render not-found", async () => {
    GET.mockResolvedValue({
      error: { detail: "book 7 not found" },
      response: new Response(null, { status: 404 }),
    });

    expect(await getBook(7)).toEqual({ ok: false, notFound: true, message: "book 7 not found" });
  });

  // Anything but 404 is an error to show, not a missing book: a 401 must not read as "no such book".
  it("does not flag other failures as not-found", async () => {
    GET.mockResolvedValue({ error: undefined, response: new Response(null, { status: 401 }) });

    expect(await getBook(7)).toEqual({
      ok: false,
      notFound: false,
      message: "本を取得できませんでした。",
    });
  });

  it("reports a connection failure instead of throwing", async () => {
    GET.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await getBook(7)).toEqual({
      ok: false,
      notFound: false,
      message: "バックエンドに接続できませんでした。",
    });
  });
});

describe("updateBook", () => {
  beforeEach(() => {
    PUT.mockReset();
  });

  it("sends the input to the book's path and returns the updated book", async () => {
    PUT.mockResolvedValue({ data: RAW });

    const input = { title: "リファクタリング", status: "READING" as const };
    const result = await updateBook(7, input);

    expect(PUT).toHaveBeenCalledWith("/api/books/{id}", {
      params: { path: { id: 7 } },
      body: input,
    });
    expect(result).toEqual({ ok: true, book: expect.objectContaining({ id: 7 }) });
  });

  it("builds the message from the field-level errors", async () => {
    PUT.mockResolvedValue({
      error: { errors: [{ field: "title", message: "title is required" }] },
    });

    expect(await updateBook(7, { title: "", status: "READING" })).toEqual({
      ok: false,
      message: "title: title is required",
    });
  });

  it("reports a bodyless failure as a failed update", async () => {
    PUT.mockResolvedValue({ error: undefined, data: undefined });

    expect(await updateBook(7, { title: "t", status: "READING" })).toEqual({
      ok: false,
      message: "更新に失敗しました。",
    });
  });

  it("reports a connection failure instead of throwing", async () => {
    PUT.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await updateBook(7, { title: "t", status: "READING" })).toEqual({
      ok: false,
      message: "バックエンドに接続できませんでした。",
    });
  });
});

describe("updateProgress", () => {
  beforeEach(() => {
    PUT.mockReset();
  });

  it("sends only the page to the book's progress path", async () => {
    PUT.mockResolvedValue({ data: { ...RAW, currentPage: 120 } });

    const result = await updateProgress(7, 120);

    expect(PUT).toHaveBeenCalledWith("/api/books/{id}/progress", {
      params: { path: { id: 7 } },
      body: { currentPage: 120 },
    });
    expect(result).toEqual({ ok: true, book: expect.objectContaining({ currentPage: 120 }) });
  });

  it("surfaces the backend's message", async () => {
    PUT.mockResolvedValue({ error: { detail: "currentPage must not exceed totalPages (480)" } });

    expect(await updateProgress(7, 999)).toEqual({
      ok: false,
      message: "currentPage must not exceed totalPages (480)",
    });
  });

  it("reports a bodyless failure as a failed record", async () => {
    PUT.mockResolvedValue({ error: undefined, data: undefined });

    expect(await updateProgress(7, 1)).toEqual({
      ok: false,
      message: "進捗を記録できませんでした。",
    });
  });

  it("reports a connection failure instead of throwing", async () => {
    PUT.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await updateProgress(7, 1)).toEqual({
      ok: false,
      message: "バックエンドに接続できませんでした。",
    });
  });
});

describe("deleteBook", () => {
  beforeEach(() => {
    DELETE.mockReset();
  });

  it("succeeds on a 204", async () => {
    DELETE.mockResolvedValue({ response: new Response(null, { status: 204 }) });

    expect(await deleteBook(7)).toEqual({ ok: true });
    expect(DELETE).toHaveBeenCalledWith("/api/books/{id}", { params: { path: { id: 7 } } });
  });

  // A 204 and Spring Security's bodyless 401 both leave `data` and `error` empty; only the status
  // tells them apart.
  it("does not read a bodyless 401 as a successful delete", async () => {
    DELETE.mockResolvedValue({ error: undefined, response: new Response(null, { status: 401 }) });

    expect(await deleteBook(7)).toEqual({ ok: false, message: "削除に失敗しました。" });
  });

  it("surfaces the backend's message", async () => {
    DELETE.mockResolvedValue({
      error: { detail: "book 7 not found" },
      response: new Response(null, { status: 404 }),
    });

    expect(await deleteBook(7)).toEqual({ ok: false, message: "book 7 not found" });
  });

  it("reports a connection failure instead of throwing", async () => {
    DELETE.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await deleteBook(7)).toEqual({
      ok: false,
      message: "バックエンドに接続できませんでした。",
    });
  });
});
