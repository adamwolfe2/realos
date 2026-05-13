"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  TrendingUp,
  Search,
  BarChart3,
  Eye,
  Globe,
  Check,
  ArrowRight,
  Loader2,
  Plus,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";

// ---------------------------------------------------------------------------
// ConnectHub — the unified data-connection screen.
//
// Shows every data source as a card with status (Not connected / Syncing /
// Connected) and the appropriate CTA (OAuth, install snippet, or
// configure). Used in two places:
//
//   1. /portal/connect — the dedicated hub the user can return to anytime
//      to add more data sources.
//   2. The onboarding wizard's "Connect your data" step — same component
//      embedded as one screen of the trial setup flow.
//
// Design principles:
//   - Encourage connecting EVERYTHING (more data = better insights), but
//     never block on any single source. Skip is always one click away.
//   - Each connection kicks off background sync immediately. The UI
//     reflects "Syncing now…" so the user feels progress.
//   - Insights run on-data-arrival (wired in lib/insights/triggers.ts),
//     so a connected source surfaces its first insight within minutes.
// ---------------------------------------------------------------------------

export type ConnectSourceVM = {
  id:
    | "appfolio"
    | "ga4"
    | "gsc"
    | "google_ads"
    | "meta_ads"
    | "cursive_pixel"
    | "website";
  connected: boolean;
  lastSyncAt: string | null;
  accountLabel: string | null;
};

const SOURCE_META: Record<
  ConnectSourceVM["id"],
  {
    name: string;
    tagline: string;
    category: "Property data" | "Marketing analytics" | "Paid media" | "Site";
    icon: LucideIcon;
    /** Where the user goes to start the connection. OAuth-backed sources
        navigate; pixel/website show inline configuration. */
    connectUrl?: string;
    /** True when the source needs an inline modal/snippet (Cursive pixel,
        website URL) rather than an OAuth redirect. */
    inline?: boolean;
    /** What the user gets once connected — shapes the value prop copy. */
    payoff: string;
    /** What insights this source unlocks. Surfaced as a tagline below
        the card so users know exactly what they get for connecting. */
    unlocks: string[];
  }
> = {
  appfolio: {
    name: "AppFolio",
    tagline: "Property data, leases, residents, renewals",
    category: "Property data",
    icon: Database,
    connectUrl: "/portal/settings/integrations#appfolio",
    payoff: "Live occupancy + rent roll for the buildings you choose to market",
    unlocks: [
      "Renewal cliff alerts",
      "Vacancy needs-boost insights",
      "Pricing recommendations",
      "Choose which properties LeaseStack manages — billing reflects only the buildings you mark Active",
    ],
  },
  ga4: {
    name: "Google Analytics 4",
    tagline: "Web traffic, sessions, conversions",
    category: "Marketing analytics",
    icon: TrendingUp,
    connectUrl: "/api/oauth/ga4/start",
    payoff: "Traffic-source attribution + funnel drop-off detection",
    unlocks: [
      "Traffic drop alerts",
      "Best-performing landing pages",
      "Conversion-stage drop-off",
    ],
  },
  gsc: {
    name: "Google Search Console",
    tagline: "Search rankings + organic visibility",
    category: "Marketing analytics",
    icon: Search,
    connectUrl: "/api/oauth/gsc/start",
    payoff: "Per-keyword position tracking + page-level impressions",
    unlocks: [
      "Keyword position drop alerts",
      "Pages losing impressions",
      "AI-citation gaps (vs ChatGPT/Perplexity)",
    ],
  },
  google_ads: {
    name: "Google Ads",
    tagline: "Ad spend, CPL, conversions",
    category: "Paid media",
    icon: BarChart3,
    connectUrl: "/api/oauth/google-ads/start",
    payoff: "Lead → tour → lease attribution per campaign",
    unlocks: [
      "CPL spike alerts",
      "Wasted-spend campaign flags",
      "Best-creative identification",
    ],
  },
  meta_ads: {
    name: "Meta Ads",
    tagline: "Facebook + Instagram ad spend & metrics",
    category: "Paid media",
    icon: BarChart3,
    connectUrl: "/api/oauth/meta-ads/start",
    payoff: "Cross-channel attribution + audience-exhaustion detection",
    unlocks: [
      "CPL spike alerts",
      "Custom Audience refresh recs",
      "Lead → tour attribution",
    ],
  },
  cursive_pixel: {
    name: "Cursive Pixel",
    tagline: "Visitor identification on your site",
    category: "Site",
    icon: Eye,
    connectUrl: "/portal/visitors#install",
    inline: true,
    payoff: "Identify anonymous prospects with name + email + intent score",
    unlocks: [
      "High-intent visitor alerts",
      "Best traffic-source-by-intent",
      "Abandoned-form recovery",
    ],
  },
  website: {
    name: "Your Website",
    tagline: "Per-property marketing site or your own domain",
    category: "Site",
    icon: Globe,
    connectUrl: "/portal/site-builder",
    inline: true,
    payoff: "Reputation scanning + AI-discovery monitoring on your URLs",
    unlocks: [
      "Reputation alerts (Google/Reddit/Yelp)",
      "AI-engine citation tracking",
      "Mention sentiment trends",
    ],
  },
};

const CATEGORIES = [
  "Property data",
  "Marketing analytics",
  "Paid media",
  "Site",
] as const;

export function ConnectHub({
  sources,
  variant = "page",
  onAllConnected,
}: {
  sources: ConnectSourceVM[];
  /** "page" = full /portal/connect surface with hero. "embed" = trimmed
      version inside the onboarding wizard. */
  variant?: "page" | "embed";
  /** Called when the user clicks "I'm done — show me my insights" — only
      relevant in the wizard variant. */
  onAllConnected?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const connectedCount = sources.filter((s) => s.connected).length;
  const totalCount = sources.length;
  const isComplete = connectedCount === totalCount;

  const startConnect = React.useCallback(
    (source: ConnectSourceVM) => {
      const meta = SOURCE_META[source.id];
      if (!meta?.connectUrl) return;
      setPending((p) => new Set(p).add(source.id));
      // OAuth routes are full-page redirects; in-app routes use Next router
      // for client-side nav.
      if (meta.connectUrl.startsWith("/api/")) {
        window.location.href = meta.connectUrl;
      } else {
        router.push(meta.connectUrl);
      }
    },
    [router],
  );

  const grouped = CATEGORIES.map((category) => ({
    category,
    sources: sources.filter((s) => SOURCE_META[s.id].category === category),
  }));

  return (
    <div className="space-y-8">
      {variant === "page" ? (
        // Canonical PageHeader — no more serif marketing voice. The detail
        // about "we sync immediately" lives below the progress card so the
        // top of the page stays scannable.
        <PageHeader
          title="Data sources"
          description="Connect property, analytics, ads, and search sources. Each new connection unlocks a family of automated insights, synced and analyzed the moment your first data lands."
        />
      ) : null}

      {/* Progress bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Sources connected
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {connectedCount}
            <span className="text-muted-foreground"> / {totalCount}</span>
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width: `${Math.round((connectedCount / Math.max(1, totalCount)) * 100)}%`,
            }}
          />
        </div>
        <p className="text-[12px] text-muted-foreground mt-3 leading-snug">
          {connectedCount === 0
            ? "Connect your first source to see insights flow into your dashboard."
            : connectedCount < totalCount
              ? `${totalCount - connectedCount} more source${totalCount - connectedCount === 1 ? "" : "s"} would unlock additional insight categories. Each is optional.`
              : "All sources connected. Insights will continue to refresh as new data arrives."}
        </p>
      </div>

      {/* Cards by category */}
      {grouped.map((g) =>
        g.sources.length === 0 ? null : (
          <section key={g.category} className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {g.category}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {g.sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  isPending={pending.has(source.id)}
                  onConnect={() => startConnect(source)}
                />
              ))}
            </div>
          </section>
        ),
      )}

      {variant === "embed" && onAllConnected ? (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Link
            href="/portal"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip and finish later →
          </Link>
          <button
            type="button"
            onClick={onAllConnected}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 h-10 text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            {isComplete ? "Show me my insights" : "Continue"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SourceCard({
  source,
  isPending,
  onConnect,
}: {
  source: ConnectSourceVM;
  isPending: boolean;
  onConnect: () => void;
}) {
  const meta = SOURCE_META[source.id];
  if (!meta) return null;
  const Icon = meta.icon;
  const isConnected = source.connected;

  return (
    <article
      className="rounded-lg p-3.5 transition-all"
      style={{
        backgroundColor: isConnected ? "#EFF6FF" : "#FFFFFF",
        border: `1px solid ${isConnected ? "#DBEAFE" : "#E5E5E5"}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <div
          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary shrink-0"
          aria-hidden="true"
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-foreground tracking-tight truncate">
              {meta.name}
            </h3>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary shrink-0">
                <Check className="w-2.5 h-2.5" />
                Connected
              </span>
            ) : null}
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-snug truncate">
            {meta.tagline}
            {isConnected && source.accountLabel ? (
              <> · <span className="font-mono">{source.accountLabel}</span></>
            ) : null}
            {isConnected && source.lastSyncAt ? (
              <span className="text-muted-foreground/70">
                {" · last synced "}
                {new Date(source.lastSyncAt).toLocaleDateString()}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {/* Unlocks — 2-col compact grid */}
      <div className="mt-2.5 pt-2.5 border-t border-border/40">
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {meta.unlocks.map((u) => (
            <p
              key={u}
              className="flex items-start gap-1.5 text-[11px] text-foreground/75 leading-snug"
            >
              <Check className="w-2.5 h-2.5 mt-0.5 shrink-0 text-primary" strokeWidth={2.5} />
              <span className="truncate">{u}</span>
            </p>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-end">
        {isConnected ? (
          <Link
            href={meta.connectUrl ?? "#"}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark disabled:opacity-40 transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                {meta.inline ? <Plus className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                Connect
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
