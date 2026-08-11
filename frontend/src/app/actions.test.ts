import { beforeEach, describe, expect, it, vi } from "vitest";

const createBook = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/api/books", () => ({ createBook: (...args: unknown[]) => createBook(...args) }));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const { createBookAction } = await import("./actions");
const { initialCreateBookState } = await import("./create-book-state");

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
      initialCreateBookState,
      formData({
        title: "  リファクタリング  ",
        author: " Martin Fowler ",
        totalPages: "480",
        status: "READING",
      }),
    );

    expect(createBook).toHaveBeenCalledWith({
      title: "リファクタリング",
      author: "Martin Fowler",
      totalPages: 480,
      status: "READING",
    });
  });

  it("omits blank optional fields instead of sending empty strings", async () => {
    await createBookAction(
      initialCreateBookState,
      formData({ title: "t", author: "   ", totalPages: "" }),
    );

    expect(createBook).toHaveBeenCalledWith({
      title: "t",
      author: undefined,
      totalPages: undefined,
      status: undefined,
    });
  });

  it("drops a status that is not one of the declared values", async () => {
    await createBookAction(initialCreateBookState, formData({ title: "t", status: "NOPE" }));

    expect(createBook).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("rejects a non-integer page count without calling the API", async () => {
    const state = await createBookAction(
      initialCreateBookState,
      formData({ title: "t", totalPages: "12.5" }),
    );

    expect(state).toEqual({ status: "error", message: "総ページ数は整数で入力してください。" });
    expect(createBook).not.toHaveBeenCalled();
  });

  it("refreshes the list after a successful create", async () => {
    const state = await createBookAction(initialCreateBookState, formData({ title: "t" }));

    expect(state).toEqual({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("surfaces the API message and does not refresh when the create fails", async () => {
    createBook.mockResolvedValue({ ok: false, message: "title: title is required" });

    const state = await createBookAction(initialCreateBookState, formData({ title: "" }));

    expect(state).toEqual({ status: "error", message: "title: title is required" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
