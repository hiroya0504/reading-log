import Link from "next/link";
import { notFound } from "next/navigation";
import { BookForm } from "../../../BookForm";
import { updateBookAction } from "../../../actions";
import { parseBookId } from "../book-id";
import { getBook } from "@/lib/api/books";

// Rendered per request for the same reason as the home page: it reads from the backend.
export const dynamic = "force-dynamic";

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseBookId((await params).id);
  if (id === undefined) {
    notFound();
  }

  const result = await getBook(id);
  if (!result.ok && result.notFound) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href={`/books/${id}`}
        className="w-fit text-sm text-accent no-underline hover:underline"
      >
        ← 本に戻る
      </Link>
      <h1 className="font-serif text-[32px] font-bold">書誌情報を編集</h1>
      {result.ok ? (
        <BookForm
          action={updateBookAction.bind(null, id)}
          initial={result.book}
          submitLabel="保存する"
          pendingLabel="保存中..."
          successMessage="保存しました。"
        />
      ) : (
        <p
          role="alert"
          className="rounded-md border border-danger p-6 text-center text-sm text-danger"
        >
          {result.message}
        </p>
      )}
    </main>
  );
}
