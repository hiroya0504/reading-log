/**
 * The book id from the `[id]` segment, or `undefined` when the segment is not one.
 *
 * `/^\d+$/` rather than `Number()` alone: `Number("")` is 0 and `Number("1e3")` is 1000, and neither
 * is a URL anyone meant as a book id.
 */
export function parseBookId(raw: string): number | undefined {
  return /^\d+$/.test(raw) ? Number(raw) : undefined;
}
