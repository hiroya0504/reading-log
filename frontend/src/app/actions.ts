"use server";

import { revalidatePath } from "next/cache";
import { createBook, type BookStatus } from "@/lib/api/books";
import type { CreateBookState } from "./create-book-state";

const STATUSES: BookStatus[] = ["WANT_TO_READ", "READING", "DONE"];

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : undefined;
}

/**
 * The bridge between the form (a client component) and `client.ts` (server-only). Field rules are
 * not re-implemented here: the backend owns them, and duplicating `@NotBlank` / `@Positive` on this
 * side would give two sets of rules that drift apart. This only shapes `FormData` into the request
 * body and passes the backend's message back to the form.
 */
export async function createBookAction(
  _previous: CreateBookState,
  formData: FormData,
): Promise<CreateBookState> {
  const rawStatus = formData.get("status");
  const status =
    typeof rawStatus === "string" && STATUSES.includes(rawStatus as BookStatus)
      ? (rawStatus as BookStatus)
      : undefined;

  const rawTotalPages = optionalText(formData.get("totalPages"));
  const totalPages = rawTotalPages === undefined ? undefined : Number(rawTotalPages);
  if (totalPages !== undefined && !Number.isInteger(totalPages)) {
    return { status: "error", message: "総ページ数は整数で入力してください。" };
  }

  const result = await createBook({
    title: optionalText(formData.get("title")) ?? "",
    author: optionalText(formData.get("author")),
    totalPages,
    status,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/");
  return { status: "success" };
}
