/**
 * Shared between the server action and the client form, so it cannot live in either.
 *
 * `actions.ts` carries `"use server"`, and such a module may only export async functions — a
 * constant like {@link initialCreateBookState} is not a legal export there. Importing it from the
 * client form would also drag `client.ts` (which is `server-only`) into the browser bundle and fail
 * the build. This module holds no runtime dependencies, so both sides can import it freely.
 */
export type CreateBookState =
  { status: "idle" } | { status: "success" } | { status: "error"; message: string };

export const initialCreateBookState: CreateBookState = { status: "idle" };
