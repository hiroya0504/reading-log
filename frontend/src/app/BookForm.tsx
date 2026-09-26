"use client";

import { useActionState } from "react";
import type { Book } from "@/lib/api/books";
import { initialBookFormState, type BookFormState } from "./book-form-state";

export type BookFormAction = (
  previous: BookFormState,
  formData: FormData,
) => Promise<BookFormState>;

type Props = {
  action: BookFormAction;
  /** Pre-fills the fields for editing. Omitted when registering a new book. */
  initial?: Book;
  submitLabel?: string;
  pendingLabel?: string;
  successMessage?: string;
};

/**
 * Used for both registering and editing a book.
 *
 * The action arrives as a prop rather than being imported here. `actions.ts` reaches `client.ts`,
 * which is `server-only`, so importing it from a client component would be a build error — and
 * taking it as a prop is also what makes this component testable with a stub.
 *
 * <p>No `required` attribute on the title: the backend's `@NotBlank` is the single source of truth
 * for what a valid book is, and the browser blocking submission would leave that path unexercised.
 */
export function BookForm({
  action,
  initial,
  submitLabel = "登録する",
  pendingLabel = "登録中...",
  successMessage = "登録しました。",
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialBookFormState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <label className="flex flex-col gap-1 text-sm">
        書名
        <input
          name="title"
          type="text"
          defaultValue={initial?.title}
          className="rounded border px-2 py-1"
          placeholder="エラーハンドリング入門"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        著者
        <input
          name="author"
          type="text"
          defaultValue={initial?.author ?? undefined}
          className="rounded border px-2 py-1"
        />
      </label>

      {/* Present on the create form too, not just edit: the update replaces every field, so a
          value only one of the two forms could enter would be wiped by the other. */}
      <label className="flex flex-col gap-1 text-sm">
        ISBN
        <input
          name="isbn"
          type="text"
          defaultValue={initial?.isbn ?? undefined}
          className="rounded border px-2 py-1"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          総ページ数
          <input
            name="totalPages"
            type="number"
            min="1"
            defaultValue={initial?.totalPages ?? undefined}
            className="rounded border px-2 py-1"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          状態
          <select
            name="status"
            defaultValue={initial?.status ?? "WANT_TO_READ"}
            className="rounded border px-2 py-1"
          >
            <option value="WANT_TO_READ">読みたい</option>
            <option value="READING">読書中</option>
            <option value="DONE">読了</option>
          </select>
        </label>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}

      {/* Without this the form looks untouched after a successful submit — React resets the fields
          and nothing else changes — so the natural reaction is to press the button again and file
          the same book twice. Nothing in the database prevents the duplicate. */}
      {state.status === "success" && (
        <p role="status" className="text-sm text-green-700">
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
