import { api } from "./client";
import type { components } from "./schema";

/**
 * The columns that are `NOT NULL` in the database are `required` in the contract, so they arrive
 * non-optional here and no fallback is needed for them. Only the genuinely nullable columns are
 * normalised — `undefined` to `null` — so the UI has one absent-value to branch on.
 */
type RawBook = components["schemas"]["BookResponse"];

export type BookStatus = RawBook["status"];

export type Book = {
  id: number;
  title: string;
  author: string | null;
  totalPages: number | null;
  currentPage: number;
  status: BookStatus;
};

export type BookInput = {
  title: string;
  author?: string;
  totalPages?: number;
  status?: BookStatus;
};

export type CreateBookResult = { ok: true; book: Book } | { ok: false; message: string };

function toBook(raw: RawBook): Book {
  return {
    id: raw.id,
    title: raw.title,
    author: raw.author ?? null,
    totalPages: raw.totalPages ?? null,
    currentPage: raw.currentPage,
    status: raw.status,
  };
}

/**
 * Pulls a message out of an RFC 9457 problem+json body. The backend puts field-level failures in
 * `errors[]` (see `ProblemDetailsAdvice`), which is what the user actually needs to see — `detail`
 * alone just says "Request validation failed".
 *
 * The `errors[].field` / `errors[].message` key names are an extension property, so they are not in
 * the generated schema and cannot be type-checked here. `BookApiTest` asserts their exact shape;
 * that test is what keeps this cast honest.
 */
function problemMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const body = error as {
      detail?: string;
      errors?: Array<{ field?: string; message?: string }>;
    };
    const fieldErrors = body.errors
      ?.map((e) => [e.field, e.message].filter(Boolean).join(": "))
      .filter((line) => line.length > 0);
    if (fieldErrors && fieldErrors.length > 0) {
      return fieldErrors.join(" / ");
    }
    if (body.detail) {
      return body.detail;
    }
  }
  return fallback;
}

/**
 * Returned rather than thrown. The page renders the health badge, the form and the list together;
 * a throw here would replace all three with Next.js's error page, so a failure to read the list
 * would also take away the form the user could still use.
 */
export type ListBooksResult = { ok: true; books: Book[] } | { ok: false; message: string };

export async function listBooks(): Promise<ListBooksResult> {
  try {
    const { data, error } = await api.GET("/api/books");
    if (error) {
      return { ok: false, message: problemMessage(error, "本の一覧を取得できませんでした。") };
    }
    return { ok: true, books: (data?.items ?? []).map(toBook) };
  } catch {
    // The backend not running at all is the common case in local development.
    return { ok: false, message: "本の一覧を取得できませんでした。" };
  }
}

/**
 * Unlike `getHealth`, failures are returned rather than swallowed. A badge can degrade to
 * "unreachable"; a form that silently drops the user's input cannot.
 */
export async function createBook(input: BookInput): Promise<CreateBookResult> {
  const { data, error } = await api.POST("/api/books", { body: input });
  if (error || !data) {
    return { ok: false, message: problemMessage(error, "登録に失敗しました。") };
  }
  return { ok: true, book: toBook(data) };
}
