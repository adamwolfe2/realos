import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { resolveIntegrationStatuses } from "@/lib/integrations/status";
import {
  CATEGORY_LABEL,
  INTEGRATIONS,
  type IntegrationDefinition,
  type IntegrationCategory,
} from "@/lib/integrations/catalog";
import type { IntegrationState } from "@/lib/integrations/status";
import { IntegrationIcon } from "@/components/portal/integrations/integration-icon";
import {
  StatusChip,
  VerificationRow,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";

export const metadata: Metadata = {
  title: "Connection status",
  description:
    "Read-only connection status and sync history for every data source. Connecting and managing sources happens in Data sources.",
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/integrations — read-only connection status + sync history.
//
// This page used to be a second connect hub, rivaling /portal/connect with
// its own cards, status vocabulary, and setup routes (the audit's "two rival
// hubs" finding). It is now demoted to an audit view: it answers "what is
// connected and how fresh is the data?" and nothing else. All connect /
// manage actions live on the ONE spine at /portal/connect (which links out
// to the per-provider credential forms itself).
//
// Status renders in the shared StatusChip vocabulary (green Live, never
// blue-as-success) with a VerificationRow proof line on active sources.
// ---------------------------------------------------------------------------

// IntegrationState → shared StatusChip vocabulary. States the chip does not
// model (plan gate, roadmap) render as Not connected plus a plain-text note
// beside the chip — same pattern the Connect hub uses for blocked sources.
function chipFor(state: IntegrationState): {
  status: ConnectionStatus;
  label?: string;
  note?: string;
} {
  switch (state) {
    case "connected":
      return { status: "live" };
    case "stale":
      return { status: "stale" };
    case "error":
      return { status: "error" };
    case "requested":
      return { status: "provisioning", label: "Requested — provisioning" };
    case "managed":
      return { status: "provisioning" };
    case "plan_locked":
      return { status: "not_connected", note: "Upgrade required" };
    case "coming_soon":
      return { status: "not_connected", note: "Coming soon" };
    case "available":
    default:
      return { status: "not_connected" };
  }
}

const ORDERED_CATEGORIES: IntegrationCategory[] = [
  "property_platform",
  "analytics",
  "ads",
  "communication",
  "scheduling",
  "automation",
];

export default async function IntegrationsStatusPage() {
  const scope = await requireScope();
  const [statuses, org] = await Promise.all([
    resolveIntegrationStatuses(scope.orgId),
    prisma.organization
      .findUnique({
        where: { id: scope.orgId },
        select: {
          // Marketplace on/off state — surfaced here as part of the audit
          // view without taking over the dedicated /portal/marketplace
          // surface.
          modulePixel: true,
          moduleChatbot: true,
          moduleSEO: true,
          moduleGoogleAds: true,
          moduleMetaAds: true,
          moduleCreativeStudio: true,
          moduleReferrals: true,
          modulePopups: true,
          moduleVault: true,
          moduleReputation: true,
          moduleInsights: true,
          moduleAttribution: true,
          moduleResidents: true,
          moduleTours: true,
          moduleConversations: true,
          moduleWebsite: true,
        },
      })
      .catch(() => null),
  ]);

  const statusBySlug = new Map(statuses.map((s) => [s.slug, s.state]));
  const lastSyncBySlug = new Map(
    statuses
      .filter((s) => s.lastEventAt != null)
      .map((s) => [s.slug, s.lastEventAt as Date]),
  );
  const connectedCount = statuses.filter(
    (s) => s.state === "connected" || s.state === "stale" || s.state === "error",
  ).length;
  const totalLive = INTEGRATIONS.filter((i) => !i.comingSoon).length;

  // Group integrations by category. Coming-soon items still render so
  // operators can see the roadmap.
  const grouped = ORDERED_CATEGORIES.map((cat) => ({
    category: cat,
    items: INTEGRATIONS.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connection status"
        description="Read-only status and sync history for every data source. To connect a new source or manage an existing one, head to Data sources."
      />

      {/* Summary strip — connected count + the single CTA off this page. */}
      <section
        className="rounded-[2px] border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
        aria-label="Connection summary"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {connectedCount}
          </span>
          <span className="text-xs text-muted-foreground">
            of {totalLive} sources connected
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/portal/marketplace"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Manage modules in Marketplace
            <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            href="/portal/connect"
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-none bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark transition-colors"
          >
            Manage connections
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {grouped.map((g) => (
        <section key={g.category} className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {CATEGORY_LABEL[g.category]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {g.items.map((def) => (
              <IntegrationStatusCard
                key={def.slug}
                def={def}
                state={statusBySlug.get(def.slug) ?? "available"}
                lastSyncAt={lastSyncBySlug.get(def.slug) ?? null}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Module on/off state — read-only audit of marketplace module state.
          The dedicated marketplace page is still the place to flip them. */}
      {org ? <ModuleStateGrid org={org} /> : null}
    </div>
  );
}

function IntegrationStatusCard({
  def,
  state,
  lastSyncAt,
}: {
  def: IntegrationDefinition;
  state: IntegrationState;
  lastSyncAt: Date | null;
}) {
  const chip = chipFor(state);
  const isComingSoon = state === "coming_soon";
  const isActive =
    state === "connected" || state === "stale" || state === "error";

  // Relative timestamp — only shown when the integration is active and we
  // have a recorded sync time. Formatted upstream so VerificationRow stays
  // presentation-only.
  const lastSyncLabel =
    isActive && lastSyncAt
      ? formatDistanceToNow(lastSyncAt, { addSuffix: true })
      : undefined;

  return (
    <article
      className={`rounded-[2px] border p-4 ${
        isActive
          ? "border-[#c6c6c6] bg-card"
          : isComingSoon
            ? "border-dashed border-border bg-muted/30"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <IntegrationIcon def={def} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-foreground tracking-tight truncate">
              {def.name}
            </h3>
            <span className="flex items-center gap-1.5 shrink-0">
              {/* Active sources carry their state in the VerificationRow
                  below — a header chip too would read as two disagreeing
                  chips (same rule as the Connect hub cards). */}
              {!isActive ? (
                <StatusChip status={chip.status} label={chip.label} />
              ) : null}
              {chip.note ? (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {chip.note}
                </span>
              ) : null}
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
            {def.tagline}
          </p>
        </div>
      </div>

      {/* What it lands in — so operators know which surfaces a source feeds
          when auditing data freshness. */}
      {def.landsIn.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-[#e0e0e0]">
          <div className="flex flex-wrap gap-1.5">
            {def.landsIn.slice(0, 4).map((target) => (
              <span
                key={target}
                className="inline-flex items-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground bg-secondary rounded-[2px] px-1.5 py-0.5"
              >
                {target}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sync history line — the proof row for active sources. Read-only:
          no Set up / Manage links here; the one spine is /portal/connect. */}
      {isActive ? (
        <div className="mt-3 pt-2 border-t border-[#e0e0e0]">
          <VerificationRow
            status={chip.status}
            accountLabel={def.name}
            lastSyncAt={lastSyncLabel}
          />
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Module on/off audit — read-only view of which marketplace modules are
// active for this org. The dedicated marketplace page (/portal/marketplace)
// is still the place to flip them on/off.
// ---------------------------------------------------------------------------
function ModuleStateGrid({
  org,
}: {
  org: {
    modulePixel: boolean;
    moduleChatbot: boolean;
    moduleSEO: boolean;
    moduleGoogleAds: boolean;
    moduleMetaAds: boolean;
    moduleCreativeStudio: boolean;
    moduleReferrals: boolean;
    modulePopups: boolean;
    moduleVault: boolean;
    moduleReputation: boolean;
    moduleInsights: boolean;
    moduleAttribution: boolean;
    moduleResidents: boolean;
    moduleTours: boolean;
    moduleConversations: boolean;
    moduleWebsite: boolean;
  };
}) {
  const modules: Array<{ key: keyof typeof org; label: string }> = [
    { key: "moduleWebsite", label: "Website" },
    { key: "modulePixel", label: "Visitor pixel" },
    { key: "moduleChatbot", label: "Chatbot" },
    { key: "moduleSEO", label: "SEO" },
    { key: "moduleGoogleAds", label: "Google Ads" },
    { key: "moduleMetaAds", label: "Meta Ads" },
    { key: "moduleCreativeStudio", label: "Creative studio" },
    { key: "moduleReferrals", label: "Referrals" },
    { key: "modulePopups", label: "Popups" },
    { key: "moduleReputation", label: "Reputation" },
    { key: "moduleInsights", label: "Insights" },
    { key: "moduleAttribution", label: "Attribution" },
    { key: "moduleResidents", label: "Residents" },
    { key: "moduleTours", label: "Tours" },
    { key: "moduleConversations", label: "Conversations" },
    { key: "moduleVault", label: "Vault" },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Modules
        </h2>
        <Link
          href="/portal/marketplace"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Manage in Marketplace
        </Link>
      </div>
      <div className="rounded-[2px] border border-border bg-card p-3">
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {modules.map((m) => {
            const on = org[m.key];
            return (
              <li
                key={m.key}
                className="flex items-center justify-between gap-2 rounded-[2px] border border-border/60 px-3 py-2 text-[12px]"
              >
                <span className="truncate text-foreground">{m.label}</span>
                <span
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] rounded-[2px] px-2 py-0.5 ${
                    on
                      ? "text-[#24a148] bg-[rgba(36,161,72,0.10)]"
                      : "text-muted-foreground bg-muted"
                  }`}
                >
                  {on ? "On" : "Off"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
