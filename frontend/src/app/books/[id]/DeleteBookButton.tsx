"use client";

import { useState, useTransition } from "react";
import type { BookFormState } from "../../book-form-state";

export type DeleteBookAction = () => Promise<BookFormState>;

/**
 * Two-step rather than `window.confirm`: the confirmation is part of the page, so it can be tested
 * and styled like the rest of it. Deletion cannot be undone, so a single misplaced click must not
 * be enough.
 *
 * The action is a prop for the same reasons `BookForm` takes one.
 */
export function DeleteBookButton({ action }: { action: DeleteBookAction }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-fit rounded border border-red-300 px-4 py-1.5 text-sm text-red-700"
      >
        削除する
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-300 p-4">
      <p className="text-sm">この本を削除します。元に戻せません。</p>
      {error !== undefined && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              // Only a failure comes back; success redirects away from this page.
              const result = await action();
              if (result.status === "error") {
                setError(result.message);
              }
            })
          }
          className="rounded bg-red-700 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? "削除中..." : "本当に削除する"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(undefined);
          }}
          className="rounded border px-4 py-1.5 text-sm"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
