import Link from "next/link";
import type { Book } from "@/lib/api/books";
import { ProgressBar, progressPercent } from "./ProgressBar";
import { BookCover } from "./ui/BookCover";
import { authorLabel } from "./ui/book-info";
import { card, sectionHeading } from "./ui/styles";

/** The books being read, up front, since recording a page is what the app is opened for most. */
export function ReadingNow({ books }: { books: Book[] }) {
  if (books.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="reading-now" className="flex flex-col gap-4">
      <h2 id="reading-now" className={sectionHeading}>
        いま読んでいる本
      </h2>
      <ul className="grid gap-5 sm:grid-cols-2">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={`/books/${book.id}`}
              className={`${card} flex gap-5 p-5 text-ink no-underline hover:border-accent`}
            >
              <BookCover book={book} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-serif text-lg leading-snug font-bold">{book.title}</span>
                  <span className="text-[13px] text-muted">{authorLabel(book.author)}</span>
                </div>
                <Progress book={book} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Progress({ book }: { book: Book }) {
  if (book.totalPages === null) {
    return <span className="text-[13px] text-muted">{book.currentPage} ページまで</span>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted">
          {book.currentPage} / {book.totalPages} ページ
        </span>
        <span className="font-serif text-[22px] font-bold text-accent">
          {progressPercent(book.currentPage, book.totalPages)}%
        </span>
      </div>
      <ProgressBar
        currentPage={book.currentPage}
        totalPages={book.totalPages}
        label={`${book.title} の進捗`}
      />
    </div>
  );
}
