"use client";

import { useActionState } from "react";
import type { Book } from "@/lib/api/books";
import { initialBookFormState, type BookFormState } from "./book-form-state";
import { STATUS_FLOW, STATUS_LABELS } from "./ui/status";
import { buttonPrimary, card, fieldInput, fieldLabel } from "./ui/styles";

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
    <form action={formAction} className={`${card} flex flex-col gap-5 p-6 sm:p-8`}>
      <label className={fieldLabel}>
        書名
        <input
          name="title"
          type="text"
          defaultValue={initial?.title}
          className={fieldInput}
          placeholder="エラーハンドリング入門"
        />
      </label>

      <label className={fieldLabel}>
        著者
        <input
          name="author"
          type="text"
          defaultValue={initial?.author ?? undefined}
          className={fieldInput}
        />
      </label>

      {/* Present on the create form too, not just edit: the update replaces every field, so a
          value only one of the two forms could enter would be wiped by the other. */}
      <label className={fieldLabel}>
        ISBN
        <input
          name="isbn"
          type="text"
          defaultValue={initial?.isbn ?? undefined}
          className={fieldInput}
        />
      </label>

      <div className="flex flex-wrap gap-4">
        <label className={`${fieldLabel} flex-1`}>
          総ページ数
          <input
            name="totalPages"
            type="number"
            min="1"
            defaultValue={initial?.totalPages ?? undefined}
            className={fieldInput}
          />
        </label>

        <label className={`${fieldLabel} flex-1`}>
          状態
          <select
            name="status"
            defaultValue={initial?.status ?? "WANT_TO_READ"}
            className={fieldInput}
          >
            {STATUS_FLOW.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      {/* Without this the form looks untouched after a successful submit — React resets the fields
          and nothing else changes — so the natural reaction is to press the button again and file
          the same book twice. Nothing in the database prevents the duplicate. */}
      {state.status === "success" && (
        <p role="status" className="text-sm text-accent">
          {successMessage}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
