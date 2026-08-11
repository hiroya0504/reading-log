import { api } from "./client";
import type { components } from "./schema";

/**
 * Every field on the generated `BookResponse` is optional: springdoc cannot tell which columns are
 * `NOT NULL`, so it marks them all nullable. Rather than sprinkle `?? ""` through the UI, this
 * module narrows the shape once, here, at the boundary.
 */
type RawBook = components["schemas"]["BookResponse"];

export type BookStatus = NonNullable<RawBook["status"]>;

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
    id: raw.id ?? 0,
    title: raw.title ?? "",
    author: raw.author ?? null,
    totalPages: raw.totalPages ?? null,
    currentPage: raw.currentPage ?? 0,
    status: raw.status ?? "WANT_TO_READ",
  };
}

/**
 * Pulls a message out of an RFC 9457 problem+json body. The backend puts field-level failures in
 * `errors[]` (see `ProblemDetailsAdvice`), which is what the user actually needs to see — `detail`
 * alone just says "Request validation failed".
 */
function problemMessage(error: unknown): string {
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
  return "登録に失敗しました。";
}

export async function listBooks(): Promise<Book[]> {
  const { data, error } = await api.GET("/api/books");
  if (error) {
    throw new Error(problemMessage(error));
  }
  return (data?.items ?? []).map(toBook);
}

/**
 * Unlike `getHealth`, failures are returned rather than swallowed. A badge can degrade to
 * "unreachable"; a form that silently drops the user's input cannot.
 */
export async function createBook(input: BookInput): Promise<CreateBookResult> {
  const { data, error } = await api.POST("/api/books", { body: input });
  if (error || !data) {
    return { ok: false, message: problemMessage(error) };
  }
  return { ok: true, book: toBook(data) };
}
