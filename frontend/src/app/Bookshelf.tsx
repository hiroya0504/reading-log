import Link from "next/link";
import type { Book, BookStatus } from "@/lib/api/books";
import { progressPercent } from "./ProgressBar";
import { SHELF_PAGE_SIZE, pageCount, shelfHref } from "./shelf";
import { BookCover } from "./ui/BookCover";
import { STATUSES, STATUS_CHIP_CLASSES, STATUS_LABELS } from "./ui/status";
import { sectionHeading } from "./ui/styles";

type Props = {
  /** One page, already narrowed to `filter` by the backend. */
  books: Book[];
  /** How many books match `filter` in all, across every page. */
  total: number;
  /** Per status over the whole shelf, for the filter links. */
  counts: Record<BookStatus, number>;
  filter: BookStatus | undefined;
  page: number;
  error?: string;
};

/**
 * Presentational only — it receives books and renders them. Keeping the fetch in the page is what
 * lets this be tested without standing up the API.
 */
export function Bookshelf({ books, total, counts, filter, page, error }: Props) {
  const all = counts.READING + counts.WANT_TO_READ + counts.DONE;

  return (
    <section aria-labelledby="bookshelf" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="bookshelf" className={sectionHeading}>
          本棚
        </h2>
        {error === undefined && (
          <nav aria-label="状態で絞り込む" className="flex flex-wrap gap-1">
            <FilterLink href={shelfHref(undefined, 1)} current={filter === undefined}>
              すべて {all}
            </FilterLink>
            {STATUSES.map((status) => (
              <FilterLink key={status} href={shelfHref(status, 1)} current={filter === status}>
                {STATUS_LABELS[status]} {counts[status]}
              </FilterLink>
            ))}
          </nav>
        )}
      </div>
      <ShelfBody books={books} all={all} total={total} filter={filter} page={page} error={error} />
    </section>
  );
}

function ShelfBody({
  books,
  all,
  total,
  filter,
  page,
  error,
}: {
  books: Book[];
  all: number;
  total: number;
  filter: BookStatus | undefined;
  page: number;
  error?: string;
}) {
  // "Could not read the shelf" and "there are no books" must not look alike: telling someone their
  // shelf is empty when the request failed reads as data loss.
  if (error !== undefined) {
    return (
      <p
        role="alert"
        className="rounded-md border border-danger p-6 text-center text-sm text-danger"
      >
        {error}
      </p>
    );
  }
  if (all === 0) {
    return (
      <p className="rounded-md border border-dashed border-line p-8 text-center text-sm text-muted">
        まだ本がありません。
        <Link href="/books/new" className="text-accent underline">
          最初の 1 冊を登録する
        </Link>
      </p>
    );
  }
  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed border-line p-8 text-center text-sm text-muted">
        {filter === undefined ? "" : STATUS_LABELS[filter]}の本はありません。
      </p>
    );
  }
  // Only a hand-edited or stale URL gets here: a page past the end of a shelf that has books.
  if (books.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line p-8 text-center text-sm text-muted">
        このページに本はありません。
        <Link href={shelfHref(filter, 1)} className="text-accent underline">
          最初のページへ
        </Link>
      </p>
    );
  }
  return (
    <>
      <BookGrid books={books} />
      <Pagination filter={filter} page={page} pages={pageCount(total, SHELF_PAGE_SIZE)} />
    </>
  );
}

function BookGrid({ books }: { books: Book[] }) {
  return (
    <ul
      aria-label="本棚の本"
      className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 md:grid-cols-5"
    >
      {books.map((book) => (
        <li key={book.id} className="flex flex-col gap-2.5">
          {/* Named by the title alone: the cover repeats it but is hidden from assistive tech. */}
          <Link href={`/books/${book.id}`} aria-label={book.title} className="hover:opacity-90">
            <BookCover book={book} size="fill" />
          </Link>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`rounded-[3px] px-2 py-0.5 text-xs font-medium ${STATUS_CHIP_CLASSES[book.status]}`}
            >
              {STATUS_LABELS[book.status]}
            </span>
            <span className="text-xs text-muted">{pagesNote(book)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Hidden when everything fits on one page. */
function Pagination({
  filter,
  page,
  pages,
}: {
  filter: BookStatus | undefined;
  page: number;
  pages: number;
}) {
  if (pages <= 1) {
    return null;
  }
  return (
    <nav aria-label="本棚のページ" className="flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={shelfHref(filter, page - 1)} className="text-accent hover:underline">
          ← 前へ
        </Link>
      ) : (
        <span className="text-muted opacity-50">← 前へ</span>
      )}
      <span className="text-muted" aria-current="page">
        {page} / {pages} ページ
      </span>
      {page < pages ? (
        <Link href={shelfHref(filter, page + 1)} className="text-accent hover:underline">
          次へ →
        </Link>
      ) : (
        <span className="text-muted opacity-50">次へ →</span>
      )}
    </nav>
  );
}

/** How far into a book being read; how long a book otherwise. Nothing when the length is unknown. */
function pagesNote(book: Book): string {
  if (book.totalPages === null) {
    return "";
  }
  return book.status === "READING"
    ? `${progressPercent(book.currentPage, book.totalPages)}%`
    : `${book.totalPages} ページ`;
}

function FilterLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] no-underline ${
        current ? "border-ink bg-ink text-paper" : "border-line text-ink hover:bg-card"
      }`}
    >
      {children}
    </Link>
  );
}
