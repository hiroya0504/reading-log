import Link from "next/link";
import type { Book, BookStatus } from "@/lib/api/books";
import { ProgressBar } from "./ProgressBar";

const STATUS_LABELS: Record<BookStatus, string> = {
  WANT_TO_READ: "読みたい",
  READING: "読書中",
  DONE: "読了",
};

const STATUS_CLASSES: Record<BookStatus, string> = {
  WANT_TO_READ: "bg-slate-100 text-slate-900",
  READING: "bg-blue-100 text-blue-900",
  DONE: "bg-green-100 text-green-900",
};

/**
 * Presentational only — it receives books and renders them. Keeping the fetch in the page (as
 * `HealthBadge` does) is what lets this be tested without standing up the API.
 */
export function BookList({ books, error }: { books: Book[]; error?: string }) {
  // "Could not read the list" and "there are no books" must not look alike: telling someone their
  // shelf is empty when the request failed reads as data loss.
  if (error !== undefined) {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 p-6 text-center text-sm text-red-700"
      >
        {error}
      </p>
    );
  }

  if (books.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm opacity-70">
        まだ本がありません。最初の 1 冊を登録してください。
      </p>
    );
  }

  return (
    <ul aria-label="登録した本" className="flex flex-col gap-2">
      {books.map((book) => (
        <li key={book.id} className="flex flex-col gap-1 rounded-md border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <Link href={`/books/${book.id}`} className="font-medium hover:underline">
              {book.title}
            </Link>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASSES[book.status]}`}
            >
              {STATUS_LABELS[book.status]}
            </span>
          </div>
          <div className="text-sm opacity-70">
            {book.author ?? "著者不明"}
            {book.totalPages !== null && (
              <span>
                {" ・ "}
                {book.currentPage} / {book.totalPages} ページ
              </span>
            )}
          </div>
          {book.totalPages !== null && (
            <ProgressBar
              currentPage={book.currentPage}
              totalPages={book.totalPages}
              label={`${book.title} の進捗`}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
