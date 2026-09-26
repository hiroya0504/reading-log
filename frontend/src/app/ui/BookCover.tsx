import Image from "next/image";
import type { Book } from "@/lib/api/books";

/**
 * Stand-in covers for books without a real one. Deep, low-chroma colours so the light title text
 * stays readable, and so they sit on the paper background in both themes.
 */
export const COVER_COLORS = ["#2e4a6b", "#7a3b2e", "#2f5245", "#5a4636", "#3a3632", "#4b3f63"];

/** Keyed on the id, not the position, so a book keeps its colour when the shelf is filtered. */
export function coverColor(id: number): string {
  return COVER_COLORS[id % COVER_COLORS.length];
}

const BOX_CLASSES = {
  sm: "h-[140px] w-24 shrink-0",
  md: "h-[218px] w-[150px] shrink-0",
  fill: "aspect-[2/3] w-full",
} as const;

const TEXT_CLASSES = {
  sm: "px-2.5 py-3 text-xs",
  md: "px-3.5 py-[18px] text-base",
  fill: "px-4 py-5 text-lg",
} as const;

/** What the browser should fetch for each box, so a 96px cover does not download a large image. */
const IMAGE_SIZES = {
  sm: "96px",
  md: "150px",
  fill: "(min-width: 768px) 20vw, 50vw",
} as const;

const SHAPE = "rounded-[3px_8px_8px_3px] shadow-[0_6px_14px_rgba(42,36,31,0.18)]";

/**
 * The real cover when the book has one, a drawn one from the title otherwise.
 *
 * Decorative either way: the title and author are always printed next to it or given by the link
 * around it, so the cover is hidden from assistive technology to avoid reading them twice.
 */
export function BookCover({
  book,
  size,
}: {
  book: Pick<Book, "id" | "title" | "author" | "coverUrl">;
  size: keyof typeof BOX_CLASSES;
}) {
  if (book.coverUrl !== null) {
    return (
      <div
        aria-hidden="true"
        className={`relative overflow-hidden bg-track ${SHAPE} ${BOX_CLASSES[size]}`}
      >
        <Image
          src={book.coverUrl}
          alt={`${book.title} の表紙`}
          fill
          sizes={IMAGE_SIZES[size]}
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: coverColor(book.id) }}
      className={`flex flex-col justify-between text-[#fbf8f1] ${SHAPE} shadow-[inset_5px_0_0_rgba(0,0,0,0.18)] ${BOX_CLASSES[size]} ${TEXT_CLASSES[size]}`}
    >
      <span className="font-serif leading-snug font-bold">{book.title}</span>
      {size !== "sm" && book.author !== null && (
        <span className="text-[11px] opacity-90">{book.author}</span>
      )}
    </div>
  );
}
