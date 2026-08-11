import { HealthBadge } from "./HealthBadge";
import { getHealth } from "@/lib/api/health";

// Rendered per request: this page talks to the backend, which is not running during `next build`.
// Without this the build would try to prerender it and CI would depend on a live API.
export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await getHealth();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 p-8">
      <h1 className="text-2xl font-bold">reading-log</h1>
      <p className="text-sm opacity-70">読んだ本を記録する。</p>
      <HealthBadge status={status} />
    </main>
  );
}
