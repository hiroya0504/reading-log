import { beforeEach, describe, expect, it, vi } from "vitest";

// Only what lies outside the app is replaced (test-rules.md, "frontend での境界"): the backend
// behind `client.ts` and the Next.js runtime. `@/lib/api/books` runs for real, so the request each
// action ends up sending — and the message it builds from a failure — is what gets checked.
const GET = vi.fn();
const POST = vi.fn();
const PUT = vi.fn();
const DELETE = vi.fn();
const revalidatePath = vi.fn();
// The real `redirect` throws to abort rendering; the stub does the same so code after it is proven
// unreachable rather than merely unexercised.
const redirect = vi.fn<(path: string) => never>(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/lib/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => GET(...args),
    POST: (...args: unknown[]) => POST(...args),
    PUT: (...args: unknown[]) => PUT(...args),
    DELETE: (...args: unknown[]) => DELETE(...args),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }));

const {
  createBookAction,
  updateBookAction,
  updateProgressAction,
  updateStatusAction,
  deleteBookAction,
} = await import("./actions");
const { initialBookFormState } = await import("./book-form-state");

const BOOK = {
  id: 7,
  title: "t",
  currentPage: 0,
  status: "WANT_TO_READ",
  createdAt: "2026-09-20T00:00:00Z",
  updatedAt: "2026-09-20T00:00:00Z",
};

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function fieldError(field: string, message: string) {
  return { error: { errors: [{ field, message }] } };
}

beforeEach(() => {
  GET.mockReset().mockResolvedValue({ data: BOOK, response: { status: 200 } });
  POST.mockReset().mockResolvedValue({ data: BOOK });
  PUT.mockReset().mockResolvedValue({ data: BOOK });
  DELETE.mockReset().mockResolvedValue({ response: { ok: true, status: 204 } });
  revalidatePath.mockReset();
  redirect.mockClear();
});

describe("createBookAction", () => {
  it("sends the trimmed fields to the API", async () => {
    await expect(
      createBookAction(
        initialBookFormState,
        formData({
          title: "  リファクタリング  ",
          author: " Martin Fowler ",
          isbn: " 9784274224546 ",
          totalPages: "480",
          status: "READING",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(POST).toHaveBeenCalledWith("/api/books", {
      body: {
        title: "リファクタリング",
        author: "Martin Fowler",
        isbn: "9784274224546",
        totalPages: 480,
        status: "READING",
      },
    });
  });

  it("omits blank optional fields instead of sending empty strings", async () => {
    await expect(
      createBookAction(
        initialBookFormState,
        formData({ title: "t", author: "   ", totalPages: "" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(POST).toHaveBeenCalledWith("/api/books", {
      body: {
        title: "t",
        author: undefined,
        isbn: undefined,
        totalPages: undefined,
        status: undefined,
      },
    });
  });

  it("drops a status that is not one of the declared values", async () => {
    await expect(
      createBookAction(initialBookFormState, formData({ title: "t", status: "NOPE" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(POST).toHaveBeenCalledWith("/api/books", {
      body: expect.objectContaining({ status: undefined }),
    });
  });

  it("rejects a non-integer page count without calling the API", async () => {
    const state = await createBookAction(
      initialBookFormState,
      formData({ title: "t", totalPages: "12.5" }),
    );

    expect(state).toEqual({ status: "error", message: "総ページ数は整数で入力してください。" });
    expect(POST).not.toHaveBeenCalled();
  });

  it("refreshes the list and moves to the new book's page after a successful create", async () => {
    POST.mockResolvedValue({ data: { ...BOOK, id: 42 } });

    await expect(createBookAction(initialBookFormState, formData({ title: "t" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledWith("/books/42");
  });

  it("surfaces the backend's field error and does not refresh when the create fails", async () => {
    POST.mockResolvedValue(fieldError("title", "title is required"));

    const state = await createBookAction(initialBookFormState, formData({ title: "" }));

    expect(state).toEqual({ status: "error", message: "title: title is required" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updateBookAction", () => {
  it("sends the parsed fields to the bound book", async () => {
    await expect(
      updateBookAction(
        7,
        initialBookFormState,
        formData({ title: " 新題 ", author: "", isbn: "123", totalPages: "10", status: "DONE" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(PUT).toHaveBeenCalledWith("/api/books/{id}", {
      params: { path: { id: 7 } },
      body: { title: "新題", author: undefined, isbn: "123", totalPages: 10, status: "DONE" },
    });
  });

  it("refreshes the list and the book's page, then returns to it, after a successful update", async () => {
    await expect(
      updateBookAction(7, initialBookFormState, formData({ title: "t", status: "READING" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/books/7");
    expect(redirect).toHaveBeenCalledWith("/books/7");
  });

  it("surfaces the backend's field error and does not refresh when the update fails", async () => {
    PUT.mockResolvedValue(fieldError("status", "status is required"));

    const state = await updateBookAction(7, initialBookFormState, formData({ title: "t" }));

    expect(state).toEqual({ status: "error", message: "status: status is required" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects a non-integer page count without calling the API", async () => {
    const state = await updateBookAction(
      7,
      initialBookFormState,
      formData({ title: "t", totalPages: "1.5", status: "READING" }),
    );

    expect(state).toEqual({ status: "error", message: "総ページ数は整数で入力してください。" });
    expect(PUT).not.toHaveBeenCalled();
  });
});

describe("updateProgressAction", () => {
  it("sends the page as a number to the bound book's progress", async () => {
    await updateProgressAction(7, initialBookFormState, formData({ currentPage: " 120 " }));

    expect(PUT).toHaveBeenCalledWith("/api/books/{id}/progress", {
      params: { path: { id: 7 } },
      body: { currentPage: 120 },
    });
  });

  it("refreshes both the list and the book's page after recording", async () => {
    const state = await updateProgressAction(
      7,
      initialBookFormState,
      formData({ currentPage: "1" }),
    );

    expect(state).toEqual({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/books/7");
  });

  // `Number("")` is 0: without the blank check, clearing the field and pressing the button would
  // rewind the book to the first page.
  it.each(["", "  ", "12.5", "abc"])("rejects %j without calling the API", async (currentPage) => {
    const state = await updateProgressAction(7, initialBookFormState, formData({ currentPage }));

    expect(state).toEqual({ status: "error", message: "ページ数を整数で入力してください。" });
    expect(PUT).not.toHaveBeenCalled();
  });

  it("surfaces the backend's message and does not refresh when recording fails", async () => {
    PUT.mockResolvedValue({ error: { detail: "currentPage must not exceed totalPages (300)" } });

    const state = await updateProgressAction(
      7,
      initialBookFormState,
      formData({ currentPage: "301" }),
    );

    expect(state).toEqual({
      status: "error",
      message: "currentPage must not exceed totalPages (300)",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateStatusAction", () => {
  it("sends the new status together with the book's other fields, unchanged", async () => {
    GET.mockResolvedValue({
      data: {
        ...BOOK,
        title: "リファクタリング",
        author: "Martin Fowler",
        isbn: "978",
        totalPages: 480,
      },
      response: { status: 200 },
    });

    await updateStatusAction(7, initialBookFormState, formData({ status: "DONE" }));

    expect(GET).toHaveBeenCalledWith("/api/books/{id}", { params: { path: { id: 7 } } });
    expect(PUT).toHaveBeenCalledWith("/api/books/{id}", {
      params: { path: { id: 7 } },
      body: {
        title: "リファクタリング",
        author: "Martin Fowler",
        isbn: "978",
        totalPages: 480,
        status: "DONE",
      },
    });
  });

  // `null` would be sent as an explicit null; `undefined` leaves the key out, which PUT reads as
  // "no value" either way — but only `undefined` matches the request type.
  it("sends the fields the book does not have as absent", async () => {
    await updateStatusAction(7, initialBookFormState, formData({ status: "READING" }));

    expect(PUT).toHaveBeenCalledWith("/api/books/{id}", {
      params: { path: { id: 7 } },
      body: {
        title: "t",
        author: undefined,
        isbn: undefined,
        totalPages: undefined,
        status: "READING",
      },
    });
  });

  it("refreshes both the list and the book's page after switching", async () => {
    const state = await updateStatusAction(7, initialBookFormState, formData({ status: "DONE" }));

    expect(state).toEqual({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/books/7");
  });

  it.each(["", "NOPE"])("rejects the status %j without calling the API", async (status) => {
    const state = await updateStatusAction(7, initialBookFormState, formData({ status }));

    expect(state).toEqual({ status: "error", message: "読書の状態を選んでください。" });
    expect(GET).not.toHaveBeenCalled();
    expect(PUT).not.toHaveBeenCalled();
  });

  it("does not write when the book cannot be read first", async () => {
    GET.mockResolvedValue({ error: { detail: "book 7 not found" }, response: { status: 404 } });

    const state = await updateStatusAction(7, initialBookFormState, formData({ status: "DONE" }));

    expect(state).toEqual({ status: "error", message: "book 7 not found" });
    expect(PUT).not.toHaveBeenCalled();
  });

  it("surfaces the backend's message and does not refresh when the write fails", async () => {
    PUT.mockResolvedValue(fieldError("status", "status is required"));

    const state = await updateStatusAction(7, initialBookFormState, formData({ status: "DONE" }));

    expect(state).toEqual({ status: "error", message: "status: status is required" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteBookAction", () => {
  it("deletes the bound book, then refreshes the list and redirects to it", async () => {
    await expect(deleteBookAction(7)).rejects.toThrow("NEXT_REDIRECT");

    expect(DELETE).toHaveBeenCalledWith("/api/books/{id}", { params: { path: { id: 7 } } });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("stays on the page and reports the failure when the delete fails", async () => {
    DELETE.mockResolvedValue({
      error: { detail: "book 7 not found" },
      response: { ok: false, status: 404 },
    });

    expect(await deleteBookAction(7)).toEqual({ status: "error", message: "book 7 not found" });
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
