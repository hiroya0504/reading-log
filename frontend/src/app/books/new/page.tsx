import Link from "next/link";
import { BookForm } from "../../BookForm";
import { createBookAction } from "../../actions";
import { BookCover } from "../../ui/BookCover";
import { buttonPrimary, fieldInput, sectionHeading } from "../../ui/styles";
import { formKey, prefillFromParams, queryToSearch, registerHeading, searchQuery } from "./prefill";
import { SearchResults } from "./SearchResults";
import { searchBooks } from "@/lib/api/bookSearch";

// Rendered per request: the search result depends on the query and reads from the backend.
export const dynamic = "force-dynamic";

export default async function NewBookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = searchQuery(params);
  const prefill = prefillFromParams(params);
  const toSearch = queryToSearch(params);
  const result = toSearch === undefined ? undefined : await searchBooks(toSearch);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/" className="w-fit text-sm text-accent no-underline hover:underline">
        ← 本棚に戻る
      </Link>
      <h1 className="font-serif text-[32px] font-bold">本を登録する</h1>

      <section aria-labelledby="search" className="flex flex-col gap-4">
        <h2 id="search" className={sectionHeading}>
          本を探す
        </h2>
        {/* A plain GET form: the results are a page of their own, with a shareable URL. */}
        <form action="/books/new" className="flex gap-3">
          <label className="flex-1">
            <span className="sr-only">書名・著者・ISBN</span>
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="書名・著者・ISBN"
              className={`${fieldInput} w-full`}
            />
          </label>
          <button type="submit" className={buttonPrimary}>
            探す
          </button>
        </form>
        {result !== undefined && toSearch !== undefined && (
          <SearchResults query={toSearch} result={result} />
        )}
      </section>

      <section aria-labelledby="register" className="flex flex-col gap-4">
        <h2 id="register" className={sectionHeading}>
          {registerHeading(prefill)}
        </h2>
        {prefill !== undefined && <BookCover book={{ ...prefill, id: 0 }} size="md" />}
        {/* Keyed on the chosen book so picking another one resets the fields. */}
        <BookForm key={formKey(prefill)} action={createBookAction} initial={prefill} />
      </section>
    </main>
  );
}
