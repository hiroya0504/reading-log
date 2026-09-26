import { api } from "./client";
import { problemMessage } from "./problem";
import type { components } from "./schema";

type RawCandidate = components["schemas"]["BookCandidateResponse"];

/** A book found by the search, with absent fields normalised to `null` as for `Book`. */
export type BookCandidate = {
  title: string;
  author: string | null;
  isbn: string | null;
  totalPages: number | null;
  coverUrl: string | null;
};

export type SearchBooksResult =
  { ok: true; candidates: BookCandidate[] } | { ok: false; message: string };

/**
 * The backend's `detail` for these is English and written for logs; what the user needs is
 * whether trying again later will help.
 */
const MESSAGES_BY_CODE: Record<string, string> = {
  BOOK_SEARCH_QUOTA_EXCEEDED: "検索の上限に達しました。時間をおいて試してください。",
  BOOK_SEARCH_UNAVAILABLE: "本の検索サービスに接続できませんでした。",
};

function toCandidate(raw: RawCandidate): BookCandidate {
  return {
    title: raw.title,
    author: raw.author ?? null,
    isbn: raw.isbn ?? null,
    totalPages: raw.totalPages ?? null,
    coverUrl: raw.coverUrl ?? null,
  };
}

export async function searchBooks(query: string): Promise<SearchBooksResult> {
  try {
    const { data, error } = await api.GET("/api/book-search", { params: { query: { q: query } } });
    // `items` guarded for the reason `listBooks` gives: a bodyless failure is not "no match".
    if (error || !data?.items) {
      const code = (error as { errorCode?: string } | undefined)?.errorCode;
      const known = code === undefined ? undefined : MESSAGES_BY_CODE[code];
      return { ok: false, message: known ?? problemMessage(error, "本を検索できませんでした。") };
    }
    return { ok: true, candidates: data.items.map(toCandidate) };
  } catch {
    return { ok: false, message: "バックエンドに接続できませんでした。" };
  }
}
