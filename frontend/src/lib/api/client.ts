import "server-only";

import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * The single entry point to the backend API.
 *
 * Paths, request bodies and responses are typed from `schema.d.ts`, which is generated from
 * `docs/openapi.json`. Calling a route the backend does not expose — or reading a field it no
 * longer returns — is a `pnpm typecheck` failure rather than a runtime surprise.
 *
 * `import "server-only"` makes it a build error to pull this module into a client component. That
 * keeps the credentials below on the server: they are read from non-`NEXT_PUBLIC_` environment
 * variables and would silently be `undefined` in the browser bundle.
 *
 * Swapping HTTP Basic for cookies or bearer tokens is a change to `authorizationHeader()` and
 * nothing else.
 */

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";

function authorizationHeader(): string {
  const username = process.env.API_USERNAME ?? "dev";
  const password = process.env.API_PASSWORD ?? "dev";
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

export const api = createClient<paths>({
  baseUrl: BASE_URL,
  headers: {
    Authorization: authorizationHeader(),
  },
});
