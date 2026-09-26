import type { BookStatus } from "@/lib/api/books";
import { STATUSES } from "./ui/status";

/** Four rows of the five-column grid. */
export const SHELF_PAGE_SIZE = 20;

/**
 * The `?status=` filter from the URL. Anything that is not one of the statuses — missing, a typo,
 * repeated (`?status=a&status=b`) — shows the whole shelf rather than an error: it is a view
 * setting, and an empty shelf would read as data loss.
 */
export function parseStatusFilter(raw: string | string[] | undefined): BookStatus | undefined {
  return typeof raw === "string" && (STATUSES as string[]).includes(raw)
    ? (raw as BookStatus)
    : undefined;
}

/**
 * The `?page=` number from the URL, counted from 1. Anything else falls back to the first page
 * for the same reason as the filter. A page past the end is kept: the shelf says it is empty and
 * links back, which is clearer than silently showing a different page.
 */
export function parsePage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    return 1;
  }
  const page = Number(raw);
  return page >= 1 ? page : 1;
}

/** At least one page, so an empty shelf still reads "1 / 1". */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The shelf's URL for a filter and page, leaving out whatever is at its default. */
export function shelfHref(status: BookStatus | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status !== undefined) {
    params.set("status", status);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query === "" ? "/" : `/?${query}`;
}

/**
 * The message of the first failed read, or `undefined` when all succeeded. The shelf shows one
 * error for its books and its counts: they come from the same backend and mean nothing apart.
 */
export function firstFailure(
  ...results: ({ ok: true } | { ok: false; message: string })[]
): string | undefined {
  const failed = results.find((result) => !result.ok);
  return failed === undefined || failed.ok ? undefined : failed.message;
}
