import type { Book } from "@/lib/api/books";

/**
 * Stand-in covers until real ones come from Google Books (M5). Deep, low-chroma colours so the
 * light title text stays readable, and so they sit on the paper background in both themes.
 */
export const COVER_COLORS = ["#2e4a6b", "#7a3b2e", "#2f5245", "#5a4636", "#3a3632", "#4b3f63"];

/** Keyed on the id, not the position, so a book keeps its colour when the shelf is filtered. */
export function coverColor(id: number): string {
  return COVER_COLORS[id % COVER_COLORS.length];
}

const SIZE_CLASSES = {
  sm: "h-[140px] w-24 shrink-0 px-2.5 py-3 text-xs",
  md: "h-[218px] w-[150px] shrink-0 px-3.5 py-[18px] text-base",
  fill: "aspect-[2/3] w-full px-4 py-5 text-lg",
} as const;

/**
 * Decorative: the title and author are always printed next to it or given by the link around
 * it, so the cover is hidden from assistive technology to avoid reading them twice.
 */
export function BookCover({
  book,
  size,
}: {
  book: Pick<Book, "id" | "title" | "author">;
  size: keyof typeof SIZE_CLASSES;
}) {
  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: coverColor(book.id) }}
      className={`flex flex-col justify-between rounded-[3px_8px_8px_3px] text-[#fbf8f1] shadow-[0_6px_14px_rgba(42,36,31,0.18),inset_5px_0_0_rgba(0,0,0,0.18)] ${SIZE_CLASSES[size]}`}
    >
      <span className="font-serif leading-snug font-bold">{book.title}</span>
      {size !== "sm" && book.author !== null && (
        <span className="text-[11px] opacity-90">{book.author}</span>
      )}
    </div>
  );
}
