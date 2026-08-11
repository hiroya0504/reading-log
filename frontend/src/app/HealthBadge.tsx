import type { HealthStatus } from "@/lib/api/health";

const LABELS: Record<HealthStatus, string> = {
  ok: "API 接続 OK",
  unreachable: "API に接続できません",
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span
      role="status"
      className={
        status === "ok"
          ? "inline-flex w-fit rounded-full bg-green-100 px-3 py-1 text-sm text-green-900"
          : "inline-flex w-fit rounded-full bg-red-100 px-3 py-1 text-sm text-red-900"
      }
    >
      {LABELS[status]}
    </span>
  );
}
