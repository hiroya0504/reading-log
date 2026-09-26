/**
 * Shared between the server actions and the client components, so it cannot live in either.
 *
 * `actions.ts` carries `"use server"`, and such a module may only export async functions — a
 * constant like {@link initialBookFormState} is not a legal export there. Importing it from a client
 * component would also drag `client.ts` (which is `server-only`) into the browser bundle and fail
 * the build. This module holds no runtime dependencies, so both sides can import it freely.
 */
export type BookFormState =
  { status: "idle" } | { status: "success" } | { status: "error"; message: string };

export const initialBookFormState: BookFormState = { status: "idle" };
