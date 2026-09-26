import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBookAction, updateProgressAction, updateStatusAction } from "../../actions";
import { BookCover } from "../../ui/BookCover";
import { authorLabel, bookInfoRows } from "../../ui/book-info";
import { buttonSecondary, sectionHeading } from "../../ui/styles";
import { DeleteBookButton } from "./DeleteBookButton";
import { parseBookId } from "./book-id";
import { ProgressForm } from "./ProgressForm";
import { StatusSwitcher } from "./StatusSwitcher";
import { getBook, type Book } from "@/lib/api/books";

// Rendered per request for the same reason as the home page: it reads from the backend.
export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseBookId((await params).id);
  if (id === undefined) {
    notFound();
  }

  const result = await getBook(id);
  if (!result.ok && result.notFound) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/" className="w-fit text-sm text-accent no-underline hover:underline">
        ← 本棚に戻る
      </Link>

      {result.ok ? (
        <BookDetail id={id} book={result.book} />
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

function BookDetail({ id, book }: { id: number; book: Book }) {
  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
        <BookCover book={book} size="md" />
        <div className="flex flex-col gap-2.5">
          <h1 className="font-serif text-[34px] leading-snug font-bold">{book.title}</h1>
          <p className="text-[15px] text-muted">{authorLabel(book.author)}</p>
          <div className="mt-2">
            <StatusSwitcher action={updateStatusAction.bind(null, id)} current={book.status} />
          </div>
        </div>
      </header>

      <ProgressForm action={updateProgressAction.bind(null, id)} book={book} />

      <section aria-labelledby="book-info" className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 id="book-info" className={sectionHeading}>
            書誌情報
          </h2>
          <Link href={`/books/${id}/edit`} className={buttonSecondary}>
            編集する
          </Link>
        </div>
        <dl className="grid border-t border-line-soft sm:grid-cols-2">
          {bookInfoRows(book).map((row) => (
            <div key={row.term} className="flex gap-4 border-b border-line-soft px-1 py-3.5">
              <dt className="w-24 shrink-0 text-[13px] text-muted">{row.term}</dt>
              <dd className="text-sm">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DeleteBookButton action={deleteBookAction.bind(null, id)} />
    </>
  );
}
