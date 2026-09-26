import Link from "next/link";
import { Bookshelf } from "./Bookshelf";
import { HealthBadge } from "./HealthBadge";
import { ReadingNow } from "./ReadingNow";
import { countByStatus, filterByStatus, parseStatusFilter } from "./shelf";
import { buttonPrimary } from "./ui/styles";
import { getHealth } from "@/lib/api/health";
import { listBooks } from "@/lib/api/books";

// Rendered per request: this page talks to the backend, which is not running during `next build`.
// Without this the build would try to prerender it and CI would depend on a live API.
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const filter = parseStatusFilter((await searchParams).status);
  // Both are asked unconditionally. Gating the list on the health check would not protect it —
  // `/api/health` is a static response that never touches the database, so it stays "ok" while
  // `/api/books` is failing. `listBooks` reports its own failure instead of throwing.
  const [status, result] = await Promise.all([getHealth(), listBooks()]);
  const books = result.ok ? result.books : [];

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

      <ReadingNow books={filterByStatus(books, "READING")} />

      <Bookshelf
        books={filterByStatus(books, filter)}
        counts={countByStatus(books)}
        filter={filter}
        error={result.ok ? undefined : result.message}
      />

      <footer className="mt-auto">
        <HealthBadge status={status} />
      </footer>
    </main>
  );
}
