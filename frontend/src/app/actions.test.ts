import { beforeEach, describe, expect, it, vi } from "vitest";

const createBook = vi.fn();
const updateBook = vi.fn();
const deleteBook = vi.fn();
const revalidatePath = vi.fn();
// The real `redirect` throws to abort rendering; the stub does the same so code after it is proven
// unreachable rather than merely unexercised.
const redirect = vi.fn<(path: string) => never>(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/lib/api/books", () => ({
  createBook: (...args: unknown[]) => createBook(...args),
  updateBook: (...args: unknown[]) => updateBook(...args),
  deleteBook: (...args: unknown[]) => deleteBook(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }));

const { createBookAction, updateBookAction, deleteBookAction } = await import("./actions");
const { initialBookFormState } = await import("./book-form-state");

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("createBookAction", () => {
  beforeEach(() => {
    createBook.mockReset().mockResolvedValue({ ok: true, book: {} });
    revalidatePath.mockReset();
  });

  it("passes the trimmed fields through to the API", async () => {
    await createBookAction(
      initialBookFormState,
      formData({
        title: "  リファクタリング  ",
        author: " Martin Fowler ",
        isbn: " 9784274224546 ",
        totalPages: "480",
        status: "READING",
      }),
    );

    expect(createBook).toHaveBeenCalledWith({
      title: "リファクタリング",
      author: "Martin Fowler",
      isbn: "9784274224546",
      totalPages: 480,
      status: "READING",
    });
  });

  it("omits blank optional fields instead of sending empty strings", async () => {
    await createBookAction(
      initialBookFormState,
      formData({ title: "t", author: "   ", totalPages: "" }),
    );

    expect(createBook).toHaveBeenCalledWith({
      title: "t",
      author: undefined,
      isbn: undefined,
      totalPages: undefined,
      status: undefined,
    });
  });

  it("drops a status that is not one of the declared values", async () => {
    await createBookAction(initialBookFormState, formData({ title: "t", status: "NOPE" }));

    expect(createBook).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("rejects a non-integer page count without calling the API", async () => {
    const state = await createBookAction(
      initialBookFormState,
      formData({ title: "t", totalPages: "12.5" }),
    );

    expect(state).toEqual({ status: "error", message: "総ページ数は整数で入力してください。" });
    expect(createBook).not.toHaveBeenCalled();
  });

  it("refreshes the list after a successful create", async () => {
    const state = await createBookAction(initialBookFormState, formData({ title: "t" }));

    expect(state).toEqual({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("surfaces the API message and does not refresh when the create fails", async () => {
    createBook.mockResolvedValue({ ok: false, message: "title: title is required" });

    const state = await createBookAction(initialBookFormState, formData({ title: "" }));

    expect(state).toEqual({ status: "error", message: "title: title is required" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateBookAction", () => {
  beforeEach(() => {
    updateBook.mockReset().mockResolvedValue({ ok: true, book: {} });
    revalidatePath.mockReset();
  });

  it("sends the parsed fields to the bound book", async () => {
    await updateBookAction(
      7,
      initialBookFormState,
      formData({ title: " 新題 ", author: "", isbn: "123", totalPages: "10", status: "DONE" }),
    );

    expect(updateBook).toHaveBeenCalledWith(7, {
      title: "新題",
      author: undefined,
      isbn: "123",
      totalPages: 10,
      status: "DONE",
    });
  });

  it("refreshes both the list and the book's page after a successful update", async () => {
    const state = await updateBookAction(
      7,
      initialBookFormState,
      formData({ title: "t", status: "READING" }),
    );

    expect(state).toEqual({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/books/7");
  });

  it("surfaces the API message and does not refresh when the update fails", async () => {
    updateBook.mockResolvedValue({ ok: false, message: "status: status is required" });

    const state = await updateBookAction(7, initialBookFormState, formData({ title: "t" }));

    expect(state).toEqual({ status: "error", message: "status: status is required" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a non-integer page count without calling the API", async () => {
    const state = await updateBookAction(
      7,
      initialBookFormState,
      formData({ title: "t", totalPages: "1.5", status: "READING" }),
    );

    expect(state).toEqual({ status: "error", message: "総ページ数は整数で入力してください。" });
    expect(updateBook).not.toHaveBeenCalled();
  });
});

describe("deleteBookAction", () => {
  beforeEach(() => {
    deleteBook.mockReset().mockResolvedValue({ ok: true });
    revalidatePath.mockReset();
    redirect.mockClear();
  });

  it("refreshes the list and redirects to it after a successful delete", async () => {
    await expect(deleteBookAction(7)).rejects.toThrow("NEXT_REDIRECT");

    expect(deleteBook).toHaveBeenCalledWith(7);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("stays on the page and reports the failure when the delete fails", async () => {
    deleteBook.mockResolvedValue({ ok: false, message: "book 7 not found" });

    expect(await deleteBookAction(7)).toEqual({ status: "error", message: "book 7 not found" });
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
