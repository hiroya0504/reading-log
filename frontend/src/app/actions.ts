"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBook,
  deleteBook,
  updateBook,
  updateProgress,
  type BookStatus,
} from "@/lib/api/books";
import type { BookFormState } from "./book-form-state";

const STATUSES: BookStatus[] = ["WANT_TO_READ", "READING", "DONE"];

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : undefined;
}

type ParsedBookForm =
  | {
      ok: true;
      input: {
        title: string;
        author?: string;
        isbn?: string;
        totalPages?: number;
        status?: BookStatus;
      };
    }
  | { ok: false; message: string };

/**
 * Shapes `FormData` into a request body, shared by create and update. Field rules are not
 * re-implemented here: the backend owns them, and duplicating `@NotBlank` / `@Positive` on this side
 * would give two sets of rules that drift apart. The one check is the integer parse, which the
 * backend cannot see — `Number("12.5")` would otherwise reach it as a valid-looking number.
 */
function parseBookForm(formData: FormData): ParsedBookForm {
  const rawStatus = formData.get("status");
  const status =
    typeof rawStatus === "string" && STATUSES.includes(rawStatus as BookStatus)
      ? (rawStatus as BookStatus)
      : undefined;

  const rawTotalPages = optionalText(formData.get("totalPages"));
  const totalPages = rawTotalPages === undefined ? undefined : Number(rawTotalPages);
  if (totalPages !== undefined && !Number.isInteger(totalPages)) {
    return { ok: false, message: "総ページ数は整数で入力してください。" };
  }

  return {
    ok: true,
    input: {
      title: optionalText(formData.get("title")) ?? "",
      author: optionalText(formData.get("author")),
      isbn: optionalText(formData.get("isbn")),
      totalPages,
      status,
    },
  };
}

/** The bridge between the form (a client component) and `client.ts` (server-only). */
export async function createBookAction(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const parsed = parseBookForm(formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message };
  }

  const result = await createBook(parsed.input);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/");
  return { status: "success" };
}

/**
 * Bound to a book id by the page (`updateBookAction.bind(null, id)`), so the form stays the same
 * component for create and edit.
 *
 * A missing status is sent as-is and left for the backend to reject: substituting a default here
 * would quietly move the book back to "読みたい", which is the bug the backend's `@NotNull` exists
 * to prevent.
 */
export async function updateBookAction(
  id: number,
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const parsed = parseBookForm(formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message };
  }

  const { status, ...rest } = parsed.input;
  const result = await updateBook(id, { ...rest, status: status as BookStatus });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/");
  revalidatePath(`/books/${id}`);
  return { status: "success" };
}

/**
 * Bound to a book id like {@link updateBookAction}. As in `parseBookForm`, only what the backend
 * cannot see is checked here — a blank or non-integer entry never becomes a number to send. The
 * range (0 to `totalPages`) is the backend's rule.
 */
export async function updateProgressAction(
  id: number,
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const raw = optionalText(formData.get("currentPage"));
  const currentPage = raw === undefined ? NaN : Number(raw);
  if (!Number.isInteger(currentPage)) {
    return { status: "error", message: "ページ数を整数で入力してください。" };
  }

  const result = await updateProgress(id, currentPage);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/");
  revalidatePath(`/books/${id}`);
  return { status: "success" };
}

/**
 * Redirects on success, so it only ever returns a failure. `redirect` throws by design and must stay
 * outside any try/catch.
 */
export async function deleteBookAction(id: number): Promise<BookFormState> {
  const result = await deleteBook(id);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/");
  redirect("/");
}
