import { api } from "./client";

export type HealthStatus = "ok" | "unreachable";

/**
 * First real consumer of the generated contract. The path literal and the response shape below are
 * both checked against `schema.d.ts`, so a backend change that drops `/api/health` — or stops
 * returning a `status` field — surfaces as a `pnpm typecheck` error rather than at runtime.
 */
export async function getHealth(): Promise<HealthStatus> {
  try {
    const { data, error } = await api.GET("/api/health");
    if (error || data?.status !== "ok") {
      return "unreachable";
    }
    return "ok";
  } catch {
    // The backend simply not running is the common case in local development; it should render
    // as a badge, not as an error page.
    return "unreachable";
  }
}
