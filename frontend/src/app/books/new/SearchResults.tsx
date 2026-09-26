import Link from "next/link";
import type { SearchBooksResult } from "@/lib/api/bookSearch";
import { BookCover } from "../../ui/BookCover";
import { authorLabel } from "../../ui/book-info";
import { candidateHref } from "./prefill";

/** Presentational: the page runs the search and hands the result in. */
export function SearchResults({ query, result }: { query: string; result: SearchBooksResult }) {
  if (!result.ok) {
    return (
      <p role="alert" className="rounded-md border border-danger p-5 text-sm text-danger">
        {result.message}
      </p>
    );
  }
  if (result.candidates.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line p-6 text-center text-sm text-muted">
        「{query}」に当てはまる本は見つかりませんでした。下のフォームから手で登録できます。
      </p>
    );
  }
  return (
    <ul
      aria-label="検索結果"
      className="flex flex-col divide-y divide-line-soft border-y border-line-soft"
    >
      {result.candidates.map((candidate, index) => (
        <li
          key={`${candidate.isbn ?? candidate.title}-${index}`}
          className="flex items-center gap-4 py-4"
        >
          <BookCover book={{ ...candidate, id: index }} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-serif text-base leading-snug font-bold">{candidate.title}</span>
            <span className="text-[13px] text-muted">{authorLabel(candidate.author)}</span>
            <span className="text-xs text-muted">
              {[
                candidate.totalPages === null ? null : `${candidate.totalPages} ページ`,
                candidate.isbn,
              ]
                .filter((part) => part !== null)
                .join(" ・ ")}
            </span>
          </div>
          <Link
            href={candidateHref(candidate)}
            aria-label={`「${candidate.title}」で登録する`}
            className="inline-flex h-10 shrink-0 items-center rounded border border-line px-4 text-sm text-ink no-underline hover:bg-card"
          >
            この本で登録
          </Link>
        </li>
      ))}
    </ul>
  );
}
