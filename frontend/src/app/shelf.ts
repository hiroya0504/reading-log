import type { Book, BookStatus } from "@/lib/api/books";
import { STATUSES } from "./ui/status";

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

export function countByStatus(books: Book[]): Record<BookStatus, number> {
  const counts: Record<BookStatus, number> = { READING: 0, WANT_TO_READ: 0, DONE: 0 };
  for (const book of books) {
    counts[book.status] += 1;
  }
  return counts;
}

/** The books with the given status, in their original order; all of them when there is none. */
export function filterByStatus(books: Book[], status: BookStatus | undefined): Book[] {
  return status === undefined ? books : books.filter((book) => book.status === status);
}
