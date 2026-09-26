"use client";

import { useActionState } from "react";
import type { Book } from "@/lib/api/books";
import { initialBookFormState } from "../../book-form-state";
import type { BookFormAction } from "../../BookForm";
import { ProgressBar } from "../../ProgressBar";

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
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <h2 className="text-sm font-medium">読書の進捗</h2>

      {book.totalPages !== null ? (
        <ProgressBar currentPage={book.currentPage} totalPages={book.totalPages} />
      ) : (
        <p className="text-xs opacity-70">総ページ数を登録すると進捗率が表示されます。</p>
      )}

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          今読んでいるページ
          <input
            name="currentPage"
            type="number"
            min="0"
            defaultValue={book.currentPage}
            className="w-28 rounded border px-2 py-1"
          />
        </label>
        {/* Outside the label so it does not become part of the input's accessible name. */}
        {book.totalPages !== null && (
          <span className="py-1 text-sm opacity-70">/ {book.totalPages} ページ</span>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? "記録中..." : "記録する"}
        </button>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-sm text-green-700">
          記録しました。
        </p>
      )}
    </form>
  );
}
