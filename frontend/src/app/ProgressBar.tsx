/**
 * Rounded down, not to the nearest: 99.6% shown as "100%" would claim a book is finished when a
 * page is still left. Capped at 100 as a display guard only — the backend already refuses a page
 * beyond the total.
 */
export function progressPercent(currentPage: number, totalPages: number): number {
  return Math.min(100, Math.max(0, Math.floor((currentPage * 100) / totalPages)));
}

/** Presentational and hook-free, so both server and client components can render it. */
/**
 * Just the bar. The percentage is printed by the caller, which decides how prominent it is (a
 * large figure on the book's page, a small one on the shelf).
 */
export function ProgressBar({
  currentPage,
  totalPages,
  label = "読書の進捗",
  thick = false,
}: {
  currentPage: number;
  totalPages: number;
  label?: string;
  thick?: boolean;
}) {
  const percent = progressPercent(currentPage, totalPages);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`overflow-hidden rounded-full bg-track ${thick ? "h-2" : "h-1"}`}
    >
      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}
