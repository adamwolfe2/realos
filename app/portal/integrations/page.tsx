import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Clock, AlertTriangle } from "lucide-react";
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

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Connect every data source, ad platform, and PMS in one place. Cards link out to the existing config page for each provider.",
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/integrations — canonical integrations hub.
//
// Replaces the five scattered surfaces (Setup, Connect, Marketplace,
// Vault, Settings → Integrations) with ONE source-of-truth list of every
// connector. Each card surfaces the live state (Connected / Needs setup
// / Coming soon / etc.) and links out to the underlying config page so
// the heavy per-provider UIs (AppFolio embed, OAuth flows, pixel install
// snippet) are untouched.
//
// The marketplace remains a distinct surface (seller dashboard etc.) at
// /portal/marketplace — this page just exposes its on/off state.
// ---------------------------------------------------------------------------

type PillTone = "success" | "warning" | "danger" | "neutral" | "info";

type StatePill = {
  label: string;
  tone: PillTone;
};

const STATE_PILL: Record<IntegrationState, StatePill> = {
  connected: { label: "Connected", tone: "success" },
  stale: { label: "Sync stale", tone: "warning" },
  error: { label: "Sync error", tone: "danger" },
  available: { label: "Needs setup", tone: "neutral" },
  requested: { label: "Requested", tone: "info" },
  managed: { label: "Provisioning", tone: "info" },
  plan_locked: { label: "Upgrade required", tone: "neutral" },
  coming_soon: { label: "Coming soon", tone: "neutral" },
};

// Per-integration deep link into the existing config surface. Untouched
// per-provider UIs (AppFolio embed, OAuth flows, pixel installer) keep
// living at /portal/settings/integrations#<slug>, /portal/connect, or
// per-feature pages — this hub just routes the user through.
const SETUP_HREF: Record<string, string> = {
  appfolio: "/portal/settings/integrations#appfolio",
  "visitor-identification": "/portal/settings/integrations#pixel",
  ga4: "/portal/seo",
  gsc: "/portal/seo",
  "google-ads": "/portal/settings/integrations#google-ads",
  "meta-ads": "/portal/settings/integrations#meta-ads",
};

const ORDERED_CATEGORIES: IntegrationCategory[] = [
  "property_platform",
  "analytics",
  "ads",
  "communication",
  "scheduling",
  "automation",
];

export default async function IntegrationsHubPage() {
  const scope = await requireScope();
  const [statuses, org] = await Promise.all([
    resolveIntegrationStatuses(scope.orgId),
    prisma.organization
      .findUnique({
        where: { id: scope.orgId },
        select: {
          // Marketplace on/off state — surfaced on the hub per the
          // consolidation brief without taking over the dedicated
          // /portal/marketplace surface.
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
  const connectedCount = statuses.filter(
    (s) => s.state === "connected" || s.state === "stale" || s.state === "error",
  ).length;
  const totalLive = INTEGRATIONS.filter((i) => !i.comingSoon).length;

  // Group integrations by category. Coming-soon items still render so
  // operators can see the roadmap; they just can't activate.
  const grouped = ORDERED_CATEGORIES.map((cat) => ({
    category: cat,
    items: INTEGRATIONS.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="One source of truth for every connector. Connected sources flow data into the portal automatically — cards link out to the existing config page if you need to manage credentials."
      />

      {/* Top summary strip — connected count + marketplace shortcut. */}
      <section
        className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
        aria-label="Integration summary"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {connectedCount}
          </span>
          <span className="text-xs text-muted-foreground">
            of {totalLive} sources connected
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/portal/marketplace"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Manage modules in Marketplace
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {grouped.map((g) => (
        <section key={g.category} className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {CATEGORY_LABEL[g.category]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {g.items.map((def) => (
              <IntegrationCard
                key={def.slug}
                def={def}
                state={statusBySlug.get(def.slug) ?? "available"}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Module on/off state — the marketplace is its own surface but the
          hub exposes whether each catalog module is currently enabled so
          the operator can audit add-on state without leaving the page. */}
      {org ? <ModuleStateGrid org={org} /> : null}
    </div>
  );
}

function IntegrationCard({
  def,
  state,
}: {
  def: IntegrationDefinition;
  state: IntegrationState;
}) {
  const pill = STATE_PILL[state];
  const setupHref = SETUP_HREF[def.slug] ?? "/portal/settings/integrations";
  const isComingSoon = state === "coming_soon";
  const isConnected =
    state === "connected" || state === "stale" || state === "error";

  return (
    <article
      className={`rounded-xl border p-4 transition-all hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)] ${
        isConnected
          ? "border-primary/25 bg-primary/[0.03]"
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
            <Pill pill={pill} />
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
            {def.tagline}
          </p>
        </div>
      </div>

      {/* What it lands in — compact chip row so operators know the payoff
          before they click into the config flow. */}
      {def.landsIn.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="flex flex-wrap gap-1.5">
            {def.landsIn.slice(0, 4).map((target) => (
              <span
                key={target}
                className="inline-flex items-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5"
              >
                {target}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-end gap-2">
        {isComingSoon ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            On the roadmap
          </span>
        ) : (
          <Link
            href={setupHref}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            {isConnected ? "Manage" : "Set up"}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </article>
  );
}

function Pill({ pill }: { pill: StatePill }) {
  const toneClass = (() => {
    switch (pill.tone) {
      case "success":
        return "text-primary bg-primary/10";
      case "warning":
        return "text-amber-700 bg-amber-100";
      case "danger":
        return "text-red-700 bg-red-100";
      case "info":
        return "text-blue-700 bg-blue-100";
      case "neutral":
      default:
        return "text-muted-foreground bg-muted";
    }
  })();
  const Icon =
    pill.tone === "success"
      ? Check
      : pill.tone === "danger"
        ? AlertTriangle
        : pill.tone === "warning"
          ? AlertTriangle
          : null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] rounded-full px-2 py-0.5 shrink-0 ${toneClass}`}
    >
      {Icon ? <Icon className="w-2.5 h-2.5" /> : null}
      {pill.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Module on/off audit — the integrations hub exposes which marketplace
// modules are currently active for this org. The dedicated marketplace
// page (/portal/marketplace) is still the place to flip them on/off; we
// just surface the state here so operators don't have to bounce between
// surfaces to answer "is feature X enabled?".
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
      <div className="rounded-xl border border-border bg-card p-3">
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {modules.map((m) => {
            const on = org[m.key];
            return (
              <li
                key={m.key}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-[12px]"
              >
                <span className="truncate text-foreground">{m.label}</span>
                <span
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] rounded-full px-2 py-0.5 ${
                    on
                      ? "text-primary bg-primary/10"
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
