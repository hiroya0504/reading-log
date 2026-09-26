/**
 * Rounded down, not to the nearest: 99.6% shown as "100%" would claim a book is finished when a
 * page is still left. Capped at 100 as a display guard only — the backend already refuses a page
 * beyond the total.
 */
export function progressPercent(currentPage: number, totalPages: number): number {
  return Math.min(100, Math.max(0, Math.floor((currentPage * 100) / totalPages)));
}

/** Presentational and hook-free, so both server and client components can render it. */
export function ProgressBar({
  currentPage,
  totalPages,
  label = "読書の進捗",
}: {
  currentPage: number;
  totalPages: number;
  label?: string;
}) {
  const percent = progressPercent(currentPage, totalPages);

  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums opacity-70">{percent}%</span>
    </div>
  );
}
