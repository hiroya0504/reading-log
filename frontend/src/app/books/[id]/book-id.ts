/**
 * The book id from the `[id]` segment, or `undefined` when the segment is not one.
 *
 * `/^\d+$/` rather than `Number()` alone: `Number("")` is 0 and `Number("1e3")` is 1000, and neither
 * is a URL anyone meant as a book id.
 */
export function parseBookId(raw: string): number | undefined {
  return /^\d+$/.test(raw) ? Number(raw) : undefined;
}

/**
 * Whether a failed read should become the 404 page. Only a missing book does; any other failure
 * stays on the page as an error message, so a backend outage is not reported as "no such book".
 */
export function isMissingBook(result: { ok: true } | { ok: false; notFound: boolean }): boolean {
  return !result.ok && result.notFound;
}
