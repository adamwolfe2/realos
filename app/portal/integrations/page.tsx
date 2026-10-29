import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { resolveIntegrationStatuses, type IntegrationState } from "@/lib/integrations/status";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import { Logo, Panel, Pill, type Tone } from "@/components/portal/overview/kit";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/integrations: status of every source we really support, as compact
// tiles. Connecting happens in /portal/setup (one place, per property).
// Unbuilt integrations collapse to one "Coming soon" line, and the module
// on/off grid is gone (Adam, 2026-10-28: "confusing and extra").
// ---------------------------------------------------------------------------

const STATE: Record<IntegrationState, { tone: Tone; text: string }> = {
  connected: { tone: "good", text: "Connected" },
  stale: { tone: "warn", text: "Not syncing" },
  error: { tone: "bad", text: "Needs attention" },
  requested: { tone: "warn", text: "Waiting on us" },
  managed: { tone: "brand", text: "Managed by us" },
  available: { tone: "neutral", text: "Not connected" },
  plan_locked: { tone: "neutral", text: "Upgrade to use" },
  coming_soon: { tone: "neutral", text: "Coming soon" },
};

// Sources the setup walkthrough connects; the rest connect in settings.
const IN_SETUP = new Set(["appfolio", "ga4", "gsc", "google-ads", "meta-ads"]);

export default async function IntegrationsPage() {
  const scope = await requireScope();
  const statuses = await resolveIntegrationStatuses(scope.orgId);
  const bySlug = new Map(statuses.map((s) => [s.slug, s]));

  const rows = INTEGRATIONS.map((def) => ({ def, status: bySlug.get(def.slug) ?? { slug: def.slug, state: "available" as const } }));
  const live = rows.filter((r) => r.status.state !== "coming_soon");
  const soon = rows.filter((r) => r.status.state === "coming_soon");
  const connected = live.filter((r) => ["connected", "stale", "error"].includes(r.status.state)).length;

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--t-ink)]">Integrations</h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--t-muted)]">{connected} of {live.length} connected · each one feeds your agent more to learn from</p>
        </div>
        <Link href="/portal/setup" className="inline-flex h-8 items-center gap-1.5 self-start rounded-full bg-[var(--t-primary-bg)] px-3.5 text-[13px] font-medium text-white hover:opacity-90 md:self-auto">
          Connect data <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      <Panel title="Your sources" flush>
        <ul className="grid divide-y divide-[var(--t-divider)] md:grid-cols-2 md:divide-y-0 xl:grid-cols-3 [&>li]:border-[var(--t-divider)] md:[&>li]:border-b">
          {live.map(({ def, status }) => {
            const st = STATE[status.state];
            const isConnected = ["connected", "stale", "error"].includes(status.state);
            return (
              <li key={def.slug}>
                <Link href={isConnected || !IN_SETUP.has(def.slug) ? "/portal/settings/integrations" : "/portal/setup"} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--t-wash)]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[var(--t-border)] bg-white"><Logo slug={def.slug} size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-medium text-[var(--t-ink)]">{def.name}</span>
                      <Pill tone={st.tone}>{st.text}</Pill>
                    </span>
                    <span className="block truncate text-[12.5px] text-[var(--t-muted)]">
                      {isConnected && status.lastEventAt ? `Synced ${formatDistanceToNow(status.lastEventAt, { addSuffix: true })}` : def.tagline}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      {soon.length ? (
        <p className="text-[12.5px] text-[var(--t-muted)]">
          Coming soon: {soon.map((r) => r.def.name).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
