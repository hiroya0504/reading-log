"use client";

import { useActionState } from "react";
import type { Book } from "@/lib/api/books";
import { initialBookFormState } from "../../book-form-state";
import type { BookFormAction } from "../../BookForm";
import { ProgressBar, progressPercent } from "../../ProgressBar";
import { buttonPrimary, card, fieldInput, fieldLabel, sectionHeading } from "../../ui/styles";

/**
 * Records the page the reader is on. Kept apart from `BookForm` because this is the thing done
 * every reading session, and it should not mean resubmitting the title and author.
 *
 * No `max` on the input, for the same reason `BookForm` has no `required`: the backend owns the
 * bound, and its message is what the user should see.
 *
 * The bar reads from `book`, not from the input: after a save the page is revalidated and passes
 * the stored value back in, so the bar only ever shows what was actually recorded.
 */
export function ProgressForm({ action, book }: { action: BookFormAction; book: Book }) {
  const [state, formAction, pending] = useActionState(action, initialBookFormState);

  return (
    <section
      aria-labelledby="progress"
      className={`${card} flex flex-col gap-5 p-6 sm:px-9 sm:py-8`}
    >
      <div className="flex items-baseline justify-between">
        <h2 id="progress" className={sectionHeading}>
          読書の進捗
        </h2>
        {book.totalPages !== null && (
          <span className="font-serif text-[40px] leading-none font-bold text-accent">
            {progressPercent(book.currentPage, book.totalPages)}%
          </span>
        )}
      </div>

      {book.totalPages !== null ? (
        <ProgressBar currentPage={book.currentPage} totalPages={book.totalPages} thick />
      ) : (
        <p className="text-[13px] text-muted">総ページ数を登録すると進捗率が表示されます。</p>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className={fieldLabel}>
          今読んでいるページ
          <input
            name="currentPage"
            type="number"
            min="0"
            defaultValue={book.currentPage}
            className={`${fieldInput} w-32 text-[17px]`}
          />
        </label>
        {/* Outside the label so it does not become part of the input's accessible name. */}
        {book.totalPages !== null && (
          <span className="flex h-11 items-center text-[15px] text-muted">
            / {book.totalPages} ページ
          </span>
        )}
        <button type="submit" disabled={pending} className={`${buttonPrimary} ml-auto`}>
          {pending ? "記録中..." : "記録する"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-sm text-accent">
          記録しました。
        </p>
      )}
    </section>
  );
}
