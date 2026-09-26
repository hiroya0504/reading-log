import { api } from "./client";
import { problemMessage } from "./problem";
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
  isbn: string | null;
  totalPages: number | null;
  currentPage: number;
  status: BookStatus;
  coverUrl: string | null;
};

export type BookInput = {
  title: string;
  author?: string;
  isbn?: string;
  totalPages?: number;
  status?: BookStatus;
  coverUrl?: string;
};

/**
 * `PUT` replaces every editable field, so an omitted optional field is cleared rather than kept, and
 * `status` is required — the backend does not default it on update.
 */
export type BookUpdateInput = BookInput & { status: BookStatus };

export type CreateBookResult = { ok: true; book: Book } | { ok: false; message: string };

function toBook(raw: RawBook): Book {
  return {
    id: raw.id,
    title: raw.title,
    author: raw.author ?? null,
    isbn: raw.isbn ?? null,
    totalPages: raw.totalPages ?? null,
    currentPage: raw.currentPage,
    status: raw.status,
    coverUrl: raw.coverUrl ?? null,
  };
}

/**
 * Returned rather than thrown. The page renders the health badge, the form and the list together;
 * a throw here would replace all three with Next.js's error page, so a failure to read the list
 * would also take away the form the user could still use.
 */
export type ListBooksResult =
  { ok: true; books: Book[]; total: number } | { ok: false; message: string };

/** Omitted fields fall back to the backend's defaults: every status, its default page size. */
export type ListBooksQuery = { status?: BookStatus; limit?: number; offset?: number };

/** `total` counts every book under the same filter, not just this page. */
export async function listBooks(query: ListBooksQuery = {}): Promise<ListBooksResult> {
  try {
    const { data, error } = await api.GET("/api/books", { params: { query } });
    // `!data?.items` is not redundant with `error`. openapi-fetch leaves `error` falsy when a
    // non-ok response carries no body — `undefined` for `Content-Length: 0`, `""` when the body is
    // empty — and Spring Security's 401 is exactly that shape. Guarding on `error` alone would turn
    // a rejected request into `{ ok: true, books: [] }`, which the UI renders as "no books yet":
    // a failure that reads as data loss. `items` is `required` in the contract, so its absence is
    // a broken response rather than an empty shelf.
    // `total` likewise: a missing one would turn into a shelf with no pages.
    if (error || !data?.items || typeof data.total !== "number") {
      return { ok: false, message: problemMessage(error, "本の一覧を取得できませんでした。") };
    }
    return { ok: true, books: data.items.map(toBook), total: data.total };
  } catch {
    // The backend not running at all is the common case in local development. Worded differently
    // from the guard above so the two are distinguishable — both to the user (a request that was
    // answered and rejected is not the same as one that never arrived) and to the tests: with one
    // shared message, deleting the guard would leave every case falling through to here and no
    // test could tell. `createBook` splits them the same way.
    return { ok: false, message: "バックエンドに接続できませんでした。" };
  }
}

export type CountBooksResult =
  { ok: true; counts: Record<BookStatus, number> } | { ok: false; message: string };

/** Keyed by status here so the UI can look a count up with the status it already has. */
export async function countBooksByStatus(): Promise<CountBooksResult> {
  try {
    const { data, error } = await api.GET("/api/books/counts");
    if (error || !data) {
      return { ok: false, message: problemMessage(error, "本の冊数を取得できませんでした。") };
    }
    return {
      ok: true,
      counts: { WANT_TO_READ: data.wantToRead, READING: data.reading, DONE: data.done },
    };
  } catch {
    return { ok: false, message: "バックエンドに接続できませんでした。" };
  }
}

/**
 * Unlike `getHealth`, failures are returned rather than swallowed. A badge can degrade to
 * "unreachable"; a form that silently drops the user's input cannot.
 */
export async function createBook(input: BookInput): Promise<CreateBookResult> {
  try {
    const { data, error } = await api.POST("/api/books", { body: input });
    if (error || !data) {
      return { ok: false, message: problemMessage(error, "登録に失敗しました。") };
    }
    return { ok: true, book: toBook(data) };
  } catch {
    // A 4xx/5xx from the backend arrives as `error` above; this is the connection never being
    // made. openapi-fetch rethrows that, and with no error boundary in `app/` it would replace the
    // whole page — taking the form and everything the user typed with it.
    return { ok: false, message: "バックエンドに接続できませんでした。" };
  }
}

/**
 * `notFound` is split out so the page can answer with Next.js's 404 rather than an error message:
 * a missing book and another user's book both arrive here, and the backend deliberately does not
 * tell them apart.
 */
export type GetBookResult =
  { ok: true; book: Book } | { ok: false; notFound: boolean; message: string };

export async function getBook(id: number): Promise<GetBookResult> {
  try {
    const { data, error, response } = await api.GET("/api/books/{id}", {
      params: { path: { id } },
    });
    // Read before the guard: the contract declares no error responses, so `error` is typed `never`
    // and TypeScript narrows `response` to `never` inside the failure branch as well.
    const notFound = response.status === 404;
    if (error || !data) {
      return {
        ok: false,
        notFound,
        message: problemMessage(error, "本を取得できませんでした。"),
      };
    }
    return { ok: true, book: toBook(data) };
  } catch {
    return { ok: false, notFound: false, message: "バックエンドに接続できませんでした。" };
  }
}

export type UpdateBookResult = { ok: true; book: Book } | { ok: false; message: string };

export async function updateBook(id: number, input: BookUpdateInput): Promise<UpdateBookResult> {
  try {
    const { data, error } = await api.PUT("/api/books/{id}", {
      params: { path: { id } },
      body: input,
    });
    if (error || !data) {
      return { ok: false, message: problemMessage(error, "更新に失敗しました。") };
    }
    return { ok: true, book: toBook(data) };
  } catch {
    return { ok: false, message: "バックエンドに接続できませんでした。" };
  }
}

/**
 * Separate from `updateBook` so recording a page does not resend — and risk clearing — the
 * bibliographic fields. A page beyond `totalPages` comes back as a failure with the backend's
 * message.
 */
export async function updateProgress(id: number, currentPage: number): Promise<UpdateBookResult> {
  try {
    const { data, error } = await api.PUT("/api/books/{id}/progress", {
      params: { path: { id } },
      body: { currentPage },
    });
    if (error || !data) {
      return { ok: false, message: problemMessage(error, "進捗を記録できませんでした。") };
    }
    return { ok: true, book: toBook(data) };
  } catch {
    return { ok: false, message: "バックエンドに接続できませんでした。" };
  }
}

export type DeleteBookResult = { ok: true } | { ok: false; message: string };

/**
 * Success is judged from the status, not from `data`: a 204 has no body, so `data` is empty on
 * success and on a bodyless 401 alike.
 */
export async function deleteBook(id: number): Promise<DeleteBookResult> {
  try {
    const { error, response } = await api.DELETE("/api/books/{id}", {
      params: { path: { id } },
    });
    if (error || !response.ok) {
      return { ok: false, message: problemMessage(error, "削除に失敗しました。") };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "バックエンドに接続できませんでした。" };
  }
}
