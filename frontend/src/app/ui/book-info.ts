import type { Book } from "@/lib/api/books";

/** What a book with no author shows where the author would be. */
export function authorLabel(author: string | null): string {
  return author ?? "著者不明";
}

export type InfoRow = { term: string; value: string };

/**
 * The bibliographic rows on a book's page, in display order. A missing value is shown as "—"
 * rather than left blank, so an empty row reads as "not recorded" instead of as a rendering fault.
 */
export function bookInfoRows(book: Pick<Book, "author" | "totalPages" | "isbn">): InfoRow[] {
  return [
    { term: "著者", value: book.author ?? "—" },
    { term: "総ページ数", value: book.totalPages === null ? "—" : `${book.totalPages} ページ` },
    { term: "ISBN", value: book.isbn ?? "—" },
  ];
}
