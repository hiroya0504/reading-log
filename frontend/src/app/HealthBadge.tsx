import type { HealthStatus } from "@/lib/api/health";

const LABELS: Record<HealthStatus, string> = {
  ok: "API 接続 OK",
  unreachable: "API に接続できません",
};

/** A development aid, so it sits quietly in the footer rather than competing with the shelf. */
export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span role="status" className={status === "ok" ? "text-xs text-muted" : "text-xs text-danger"}>
      {LABELS[status]}
    </span>
  );
}
