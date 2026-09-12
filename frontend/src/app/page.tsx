import { HealthBadge } from "./HealthBadge";
import { BookForm } from "./BookForm";
import { BookList } from "./BookList";
import { createBookAction } from "./actions";
import { getHealth } from "@/lib/api/health";
import { listBooks } from "@/lib/api/books";

// Rendered per request: this page talks to the backend, which is not running during `next build`.
// Without this the build would try to prerender it and CI would depend on a live API.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Both are asked unconditionally. Gating the list on the health check would not protect it —
  // `/api/health` is a static response that never touches the database, so it stays "ok" while
  // `/api/books` is failing. `listBooks` reports its own failure instead of throwing.
  const [status, books] = await Promise.all([getHealth(), listBooks()]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">reading-log</h1>
        <p className="text-sm opacity-70">読んだ本を記録する。</p>
        <HealthBadge status={status} />
      </header>

      <BookForm action={createBookAction} />

      {books.ok ? <BookList books={books.books} /> : <BookList books={[]} error={books.message} />}
    </main>
  );
}
