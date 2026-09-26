import Link from "next/link";
import { Bookshelf } from "./Bookshelf";
import { HealthBadge } from "./HealthBadge";
import { ReadingNow } from "./ReadingNow";
import { SHELF_PAGE_SIZE, firstFailure, parsePage, parseStatusFilter, shelfOffset } from "./shelf";
import { buttonPrimary } from "./ui/styles";
import { getHealth } from "@/lib/api/health";
import { countBooksByStatus, listBooks } from "@/lib/api/books";

// Rendered per request: this page talks to the backend, which is not running during `next build`.
// Without this the build would try to prerender it and CI would depend on a live API.
export const dynamic = "force-dynamic";

/** The most the API returns at once; nobody reads more books than this at the same time. */
const READING_NOW_LIMIT = 100;

const NO_COUNTS = { READING: 0, WANT_TO_READ: 0, DONE: 0 };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const filter = parseStatusFilter(params.status);
  const page = parsePage(params.page);
  // All asked unconditionally. Gating the rest on the health check would not protect them —
  // `/api/health` is a static response that never touches the database, so it stays "ok" while
  // `/api/books` is failing. Each call reports its own failure instead of throwing.
  const [status, shelf, reading, counts] = await Promise.all([
    getHealth(),
    listBooks({ status: filter, limit: SHELF_PAGE_SIZE, offset: shelfOffset(page) }),
    listBooks({ status: "READING", limit: READING_NOW_LIMIT }),
    countBooksByStatus(),
  ]);
  // "Reading now" simply hides when its read fails; the shelf's error already says why.

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[32px] font-bold tracking-wide">reading-log</h1>
          <p className="text-sm text-muted">読んだ本と、いま読んでいる本の記録</p>
        </div>
        <Link href="/books/new" className={buttonPrimary}>
          本を登録する
        </Link>
      </header>

      <ReadingNow books={reading.ok ? reading.books : []} />

      <Bookshelf
        books={shelf.ok ? shelf.books : []}
        total={shelf.ok ? shelf.total : 0}
        counts={counts.ok ? counts.counts : NO_COUNTS}
        filter={filter}
        page={page}
        error={firstFailure(shelf, counts)}
      />

      <footer className="mt-auto">
        <HealthBadge status={status} />
      </footer>
    </main>
  );
}
