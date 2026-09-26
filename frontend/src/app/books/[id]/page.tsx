import Link from "next/link";
import { notFound } from "next/navigation";
import { BookForm } from "../../BookForm";
import { deleteBookAction, updateBookAction, updateProgressAction } from "../../actions";
import { DeleteBookButton } from "./DeleteBookButton";
import { ProgressForm } from "./ProgressForm";
import { getBook } from "@/lib/api/books";

// Rendered per request for the same reason as the home page: it reads from the backend.
export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  // `/^\d+$/` rather than `Number()` alone: `Number("")` is 0 and `Number("1e3")` is 1000, and
  // neither is a URL anyone meant as a book id.
  if (!/^\d+$/.test(rawId)) {
    notFound();
  }
  const id = Number(rawId);

  const result = await getBook(id);
  if (!result.ok && result.notFound) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm opacity-70 hover:underline">
          ← 一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold">{result.ok ? result.book.title : "本の編集"}</h1>
      </header>

      {result.ok ? (
        <>
          {/* Above the edit form: recording the page is what this screen is opened for most. */}
          <ProgressForm action={updateProgressAction.bind(null, id)} book={result.book} />
          <BookForm
            action={updateBookAction.bind(null, id)}
            initial={result.book}
            submitLabel="保存する"
            pendingLabel="保存中..."
            successMessage="保存しました。"
          />
          <DeleteBookButton action={deleteBookAction.bind(null, id)} />
        </>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-red-300 p-6 text-center text-sm text-red-700"
        >
          {result.message}
        </p>
      )}
    </main>
  );
}
