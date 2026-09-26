import type { BookFormValues } from "../../BookForm";
import type { BookCandidate } from "@/lib/api/bookSearch";

type Params = Record<string, string | string[] | undefined>;

function single(raw: string | string[] | undefined): string | undefined {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value.length > 0 ? value : undefined;
}

/** The search box's `?q=`, or `undefined` when there is nothing to search for. */
export function searchQuery(params: Params): string | undefined {
  return single(params.q);
}

/**
 * The link that opens the form filled in with a candidate. The candidate travels in the URL
 * rather than being searched for again, so choosing costs no second request to Google and always
 * fills in exactly what was shown.
 */
export function candidateHref(candidate: BookCandidate): string {
  const params = new URLSearchParams({ title: candidate.title });
  if (candidate.author !== null) params.set("author", candidate.author);
  if (candidate.isbn !== null) params.set("isbn", candidate.isbn);
  if (candidate.totalPages !== null) params.set("totalPages", String(candidate.totalPages));
  if (candidate.coverUrl !== null) params.set("coverUrl", candidate.coverUrl);
  return `/books/new?${params.toString()}`;
}

/**
 * The form's starting values from a `candidateHref` link, or `undefined` when there is no title
 * (nothing was chosen). The values are only a starting point: the user can edit them, and the
 * backend validates them on save like any typed input — including the cover's host.
 */
export function prefillFromParams(params: Params): BookFormValues | undefined {
  const title = single(params.title);
  if (title === undefined) {
    return undefined;
  }
  const pages = single(params.totalPages);
  return {
    title,
    author: single(params.author) ?? null,
    isbn: single(params.isbn) ?? null,
    totalPages: pages !== undefined && /^[1-9]\d*$/.test(pages) ? Number(pages) : null,
    coverUrl: single(params.coverUrl) ?? null,
  };
}

/**
 * What to search for on this request: the query, unless a candidate has already been chosen —
 * then the page shows the filled-in form, and searching again would spend a request on results
 * nobody looks at.
 */
export function queryToSearch(params: Params): string | undefined {
  return prefillFromParams(params) === undefined ? searchQuery(params) : undefined;
}

/** The form's heading: whether it is filled in from a chosen candidate or starts empty. */
export function registerHeading(prefill: BookFormValues | undefined): string {
  return prefill === undefined ? "手で入力する" : "この内容で登録する";
}
