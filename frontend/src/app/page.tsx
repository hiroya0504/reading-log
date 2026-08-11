import { HealthBadge } from "./HealthBadge";
import { BookForm } from "./BookForm";
import { BookList } from "./BookList";
import { createBookAction } from "./actions";
import { getHealth } from "@/lib/api/health";
import { listBooks, type Book } from "@/lib/api/books";

// Rendered per request: this page talks to the backend, which is not running during `next build`.
// Without this the build would try to prerender it and CI would depend on a live API.
export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await getHealth();

  // The health badge already tells the user the API is down; letting the list throw on top of that
  // would replace the whole page with an error boundary.
  let books: Book[] = [];
  if (status === "ok") {
    books = await listBooks();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">reading-log</h1>
        <p className="text-sm opacity-70">読んだ本を記録する。</p>
        <HealthBadge status={status} />
      </header>

      <BookForm action={createBookAction} />

      <BookList books={books} />
    </main>
  );
}
