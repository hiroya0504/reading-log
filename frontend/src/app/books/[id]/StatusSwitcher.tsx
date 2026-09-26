"use client";

import { useActionState } from "react";
import type { BookStatus } from "@/lib/api/books";
import { initialBookFormState } from "../../book-form-state";
import type { BookFormAction } from "../../BookForm";
import { STATUS_FLOW, STATUS_LABELS } from "../../ui/status";

/**
 * One press changes the status. Each button submits the form with its own `status` value, so no
 * client state is needed to know which was chosen; the page re-renders with the stored status
 * after the action revalidates it.
 */
export function StatusSwitcher({
  action,
  current,
}: {
  action: BookFormAction;
  current: BookStatus;
}) {
  const [state, formAction, pending] = useActionState(action, initialBookFormState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="読書の状態"
        className="flex w-fit overflow-hidden rounded border border-line"
      >
        {STATUS_FLOW.map((status) => (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            aria-pressed={status === current}
            disabled={pending}
            className={`h-10 px-[18px] text-sm disabled:opacity-60 ${
              status === current ? "bg-accent font-medium text-on-accent" : "text-ink hover:bg-card"
            }`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
