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
  Clock,
  Building2,
  ShieldCheck,
  Lock,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { RunAppFolioSyncButton } from "@/components/portal/integrations/run-appfolio-sync-button";
import { BRAND_LOGOS } from "@/components/portal/integrations/brand-logos";
import {
  StatusChip,
  VerificationRow,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";
import type {
  AvailabilityMap,
  ProviderAvailability,
} from "@/lib/connect/provider-availability";

// ---------------------------------------------------------------------------
// ConnectHub — the unified data-connection screen.
//
// Shows every data source as a card with an unmistakable StatusChip
// (Not connected / Connecting… / Live / Stale) and the appropriate CTA
// (OAuth, install snippet, or configure). Used in two places:
//
//   1. /portal/connect — the dedicated hub the user can return to anytime
//      to add more data sources.
//   2. The onboarding wizard's "Connect your data" step — same component
//      embedded as one screen of the trial setup flow.
//
// Design principles (Carbon-forward, 2026-07-09 spec):
//   - Encourage connecting EVERYTHING (more data = better insights), but
//     never block on any single source. Skip is always one click away.
//   - Status lives in the shared StatusChip vocabulary — green Live, never
//     blue-as-success. Connected cards get a VerificationRow proof line
//     (account + last sync), not a silent success.
//   - Each connection kicks off background sync immediately. A source that
//     is connected but has never synced shows "Connected — first sync
//     running" so the post-OAuth return is never a blank state.
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
  /** Subtle inline health chip — surfaced when the source is connected but
      not in a fully-green state (e.g. AppFolio with auto-sync paused). Not
      a banner, just a yellow action row beneath the verification line. */
  healthNote?: { label: string; href: string } | null;
  /** Server-persisted "requested but not yet live" state (Cursive pixel
      today: a provision request or in-flight self-serve setup exists but no
      pixel is bound). Survives refresh — unlike the local `pending` click
      state — so the requested→provisioning moment is never silently lost. */
  provisioning?: boolean;
};

const SOURCE_META: Record<
  ConnectSourceVM["id"],
  {
    name: string;
    tagline: string;
    category: "Property data" | "Marketing analytics" | "Paid media" | "Site";
    icon: LucideIcon;
    /** Slug into BRAND_LOGOS so the setup card shows the real platform logo
        (matching the Integrations page) instead of a generic glyph. Falls
        back to `icon` when absent (e.g. the generic "Your Website" card). */
    brandSlug?: string;
    /** Where the user goes to start the connection. OAuth-backed sources
        navigate; pixel/website show inline configuration. */
    connectUrl?: string;
    /** True when the source needs an inline modal/snippet (Cursive pixel,
        website URL) rather than an OAuth redirect. */
    inline?: boolean;
    /** What the user gets once connected — the one-line value prop rendered
        above the unlocks grid. */
    payoff: string;
    /** What insights this source unlocks. Surfaced as a tagline below
        the card so users know exactly what they get for connecting. */
    unlocks: string[];
    /** Override for the primary CTA when "Connect" isn't accurate. The
        Cursive pixel for instance uses "Request pixel" because the
        actual provisioning is a 3-5 min manual task, kicked off by an
        ops email. */
    connectLabel?: string;
  }
> = {
  appfolio: {
    name: "AppFolio",
    tagline: "Property data, leases, residents, renewals",
    category: "Property data",
    icon: Database,
    brandSlug: "appfolio",
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
    brandSlug: "ga4",
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
    brandSlug: "gsc",
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
    brandSlug: "google-ads",
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
    brandSlug: "meta-ads",
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
    brandSlug: "visitor-identification",
    // Points at the per-property pixel setup wizard (property selector + one-
    // flow webhook mint). Previously pointed at /portal/visitors#install which
    // had no install UI — that bounced back here, an infinite loop.
    connectUrl: "/portal/settings/integrations",
    payoff: "Identify anonymous prospects with name + email + intent score",
    unlocks: [
      "High-intent visitor alerts",
      "Best traffic-source-by-intent",
      "Abandoned-form recovery",
    ],
    connectLabel: "Request pixel",
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

// Prerequisite line per source — "what do I need, how long?" up front.
// Copy derived from what each connect flow actually asks for (see the
// 2026-07-09 connect-hub spec table). Rendered only while the source is
// neither connected nor blocked. The cursive line absorbs the old
// "provisioned within 4 business hours" setup note (the only code-backed
// duration; the ~N min figures are conservative editorial estimates).
const PREREQUISITES: Record<ConnectSourceVM["id"], string> = {
  appfolio:
    "You'll need: your AppFolio Reports API Client ID + Secret · ~2 min",
  ga4: "You'll need: a Google login with access to your GA4 property · ~1 min",
  gsc: "You'll need: a Google login with access to your Search Console property · ~1 min",
  google_ads:
    "You'll need: a Google login with access to your Google Ads account · ~2 min",
  meta_ads:
    "You'll need: a Facebook login with Business Manager access to your ad account · ~2 min",
  cursive_pixel:
    "You'll need: a property selected — we handle the rest · live within 4 business hours",
  website:
    "You'll need: your domain and access to its DNS settings · ~5 min",
};

// Honest per-card scope disclosure for the two write-capable OAuth scopes.
// The trust footer deliberately says "Analytics sources connect read-only"
// (GA4/GSC are readonly scopes) — Google Ads (`adwords`) and Meta
// (`ads_read` + `ads_management`) are NOT read-only, so these two cards
// carry their own 10px scope note instead of a false blanket claim.
const SCOPE_NOTES: Partial<Record<ConnectSourceVM["id"], string>> = {
  google_ads: "Uses Google's standard Ads API scope",
  meta_ads: "Uses Meta's ads_read + ads_management scopes",
};

// Per-source staleness thresholds, in hours. Render-time constants only —
// no new queries. Conservative picks per each source's natural sync cadence
// (spec risk flag 6): AppFolio runs an hourly cron so 48h is unambiguously
// wrong; GA4/GSC/ads platforms report daily-ish so 72h avoids false "Stale"
// chips; the website source is a domain binding with no sync cadence at all,
// so it never goes stale.
const STALE_AFTER_HOURS: Record<ConnectSourceVM["id"], number> = {
  appfolio: 48,
  ga4: 72,
  gsc: 72,
  google_ads: 72,
  meta_ads: 72,
  cursive_pixel: 72,
  website: Number.POSITIVE_INFINITY,
};

// Deterministic date formatter — fixed locale so the server render and the
// client hydration produce the same string (the old
// `toLocaleDateString()` call drifted with the viewer's locale).
const SYNC_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatSyncDate(iso: string): string {
  return SYNC_DATE_FORMAT.format(new Date(iso));
}

// Status ladder — every state is derivable from data the hub already
// receives. Deliberately unreachable this wave (do not fake them):
// `provisioning` (PixelProvisionRequest is not in the payload) and `error`
// (no failure signal is passed for any source).
function deriveChipState(
  source: ConnectSourceVM,
  isPending: boolean,
): { status: ConnectionStatus; label?: string } {
  if (source.connected) {
    if (source.lastSyncAt === null) {
      // Honest post-OAuth-return state: bound, but no data has landed yet.
      return { status: "connecting", label: "Connected — first sync running" };
    }
    if (source.healthNote) {
      // e.g. AppFolio auto-sync paused — the healthNote link row below
      // carries the specific label + href.
      return { status: "stale" };
    }
    const ageHours =
      (Date.now() - new Date(source.lastSyncAt).getTime()) / 3_600_000;
    if (ageHours > STALE_AFTER_HOURS[source.id]) {
      return { status: "stale" };
    }
    return { status: "live" };
  }
  if (source.provisioning) {
    // Server-persisted requested state (pixel provision request / in-flight
    // setup on file) — beats the transient local click state and survives
    // refresh. Full copy renders as the card's status line; the chip keeps
    // the six-word vocabulary.
    return { status: "provisioning" };
  }
  if (isPending) {
    // Local click state, pre-redirect.
    return { status: "connecting" };
  }
  return { status: "not_connected" };
}

const CATEGORIES = [
  "Property data",
  "Marketing analytics",
  "Paid media",
  "Site",
] as const;

// Per-property connect target. When a property is active in the switcher, the
// per-property sources route to their own setup surface with that property
// pre-selected. AppFolio (one PMS feed per workspace) and the account-level ad
// OAuth stay as-is — they connect once and map per property downstream.
function resolveConnectUrl(
  id: ConnectSourceVM["id"],
  base: string | undefined,
  propertyId: string | null,
): string | undefined {
  if (!base || !propertyId) return base;
  switch (id) {
    case "cursive_pixel":
      return `/portal/settings/integrations?propertyId=${propertyId}`;
    // /portal/seo scopes by `property` (parsePropertyFilter), NOT `propertyId`
    // — the old param name was silently ignored, so the per-property pre-select
    // never fired. (Codex.)
    case "ga4":
      return `/portal/seo?provider=GA4&property=${propertyId}`;
    case "gsc":
      return `/portal/seo?provider=GSC&property=${propertyId}`;
    case "website":
      return `/portal/site-builder?propertyId=${propertyId}`;
    default:
      return base;
  }
}

// Source icon — the real platform logo (from the shared BRAND_LOGOS used on the
// Integrations page) when the source has a brandSlug, otherwise the generic
// lucide glyph on a primary-tinted tile. Keeps Setup + Integrations visually
// consistent.
function SourceIcon({
  brandSlug,
  Icon,
}: {
  brandSlug?: string;
  Icon: LucideIcon;
}) {
  const logo = brandSlug ? BRAND_LOGOS[brandSlug] : undefined;
  if (logo) {
    return (
      <div
        className="inline-flex items-center justify-center w-7 h-7 rounded-[2px] bg-card border border-border shrink-0 p-1"
        aria-hidden="true"
        style={{ color: logo.brandColor }}
      >
        {logo.render()}
      </div>
    );
  }
  return (
    <div
      className="inline-flex items-center justify-center w-7 h-7 rounded-[2px] bg-primary/10 text-primary shrink-0"
      aria-hidden="true"
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
    </div>
  );
}

export function ConnectHub({
  sources,
  variant = "page",
  onAllConnected,
  availability,
  activePropertyId = null,
  activePropertyName = null,
}: {
  sources: ConnectSourceVM[];
  /** "page" = full /portal/connect surface with hero. "embed" = trimmed
      version inside the onboarding wizard. */
  variant?: "page" | "embed";
  /** Called when the user clicks "I'm done — show me my insights" — only
      relevant in the wizard variant. */
  onAllConnected?: () => void;
  /** The property currently selected in the switcher. When set, per-property
      sources (pixel / GA4 / GSC / site) deep-link to their setup surface with
      this property pre-selected, so each building is configured in isolation. */
  activePropertyId?: string | null;
  activePropertyName?: string | null;
  /** Per-provider availability map. When a provider is not available
      (agency-side env vars missing) the Connect button collapses into a
      "Coming soon" disabled state with the reason, instead of routing
      through to a 503 response. Optional for backwards-compat — when
      omitted, every provider is treated as available. */
  availability?: AvailabilityMap;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const connectedCount = sources.filter((s) => s.connected).length;
  const totalCount = sources.length;
  const isComplete = connectedCount === totalCount;
  const unavailableCount = availability
    ? sources.filter((s) => !s.connected && !availability[s.id]?.available)
        .length
    : 0;

  const startConnect = React.useCallback(
    (source: ConnectSourceVM) => {
      const meta = SOURCE_META[source.id];
      const url = resolveConnectUrl(source.id, meta?.connectUrl, activePropertyId);
      if (!url) return;
      setPending((p) => new Set(p).add(source.id));
      // OAuth routes are full-page redirects; in-app routes use Next router
      // for client-side nav.
      if (url.startsWith("/api/")) {
        window.location.href = url;
      } else {
        router.push(url);
      }
    },
    [router, activePropertyId],
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

      {/* Progress bar — flat, border-first (no hover shadow) */}
      <div className="rounded-[2px] border border-border bg-card p-4">
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
        {unavailableCount > 0 ? (
          <p className="text-[11px] text-muted-foreground/80 mt-2 leading-snug border-t border-border pt-2">
            <Clock className="inline w-2.5 h-2.5 mr-1 -mt-0.5" />
            {unavailableCount} source{unavailableCount === 1 ? " is" : "s are"}{" "}
            still being provisioned by your agency. You&apos;ll be notified
            the moment they come online.
          </p>
        ) : null}
      </div>

      {/* Per-property context — makes the active scope explicit so operators
          set up each building in isolation. Blue 10 wash, Carbon-flat. */}
      <div className="rounded-[2px] border border-[#a6c8ff] bg-[#edf5ff] px-4 py-2.5 text-[12px] text-foreground flex items-start gap-2">
        <Building2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
        {activePropertyName ? (
          <span>
            Setting up <span className="font-semibold">{activePropertyName}</span>.
            Pixel, GA4, GSC, and your site connect for this property. Switch
            properties in the selector above to set up another — each gets its
            own pixel, chatbot, and analytics.
          </span>
        ) : (
          <span>
            You&apos;re on <span className="font-semibold">All properties</span>.
            Pick a single property in the selector above to set up its own
            pixel, GA4, GSC, and site — every feature is configured per property.
          </span>
        )}
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
                  activePropertyId={activePropertyId}
                  isPending={pending.has(source.id)}
                  availability={availability?.[source.id]}
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
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip and finish later
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={onAllConnected}
            className="inline-flex items-center gap-2 rounded-none bg-primary text-primary-foreground px-5 h-10 text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            {isComplete ? "Show me my insights" : "Continue"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {/* Trust footer — page variant only. Every claim is verified against
          code (see the 2026-07-09 connect-hub spec): AES-256-GCM at rest in
          lib/crypto.ts; GA4/GSC use readonly scopes (the ads sources carry
          their own per-card scope notes — do NOT re-broaden this copy into a
          blanket "read-only scopes" claim, Google Ads + Meta scopes are
          write-capable); disconnect affordances exist for every connected
          account under Settings → Integrations. */}
      {variant === "page" ? (
        <div className="mt-8 border-t border-[#e0e0e0] pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[#525252]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            Credentials encrypted at rest (AES-256)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            Analytics sources connect read-only
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Unplug className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            Disconnect any connected account anytime in Settings → Integrations
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SourceCard({
  source,
  isPending,
  availability,
  onConnect,
  activePropertyId,
}: {
  source: ConnectSourceVM;
  isPending: boolean;
  availability?: ProviderAvailability;
  onConnect: () => void;
  activePropertyId: string | null;
}) {
  const meta = SOURCE_META[source.id];
  if (!meta) return null;
  const Icon = meta.icon;
  // Per-property deep-link for the href (the onClick path resolves the same).
  const connectHref =
    resolveConnectUrl(source.id, meta.connectUrl, activePropertyId) ?? "#";
  const isConnected = source.connected;
  // Card is "blocked" when not connected AND availability says it can't be
  // connected yet. Connected cards keep their structural emphasis so an
  // existing connection isn't dimmed just because the agency env later
  // degrades.
  const isBlocked =
    !isConnected && availability != null && !availability.available;
  const chip = deriveChipState(source, isPending);
  const scopeNote = SCOPE_NOTES[source.id];

  return (
    <article
      className={`rounded-[2px] p-4 ${
        isConnected
          ? "border border-[#c6c6c6] bg-card"
          : isBlocked
            ? "border border-dashed border-border bg-muted/30"
            : "border border-border bg-card"
      }`}
    >
      {/* Header row — name left, StatusChip top-right. State lives in the
          chip (green Live / blue Connecting / gray Not connected), never in
          a blue card wash. */}
      <div className="flex items-start gap-2.5">
        <SourceIcon brandSlug={meta.brandSlug} Icon={Icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-foreground tracking-tight truncate">
              {meta.name}
            </h3>
            <span className="flex items-center gap-1.5 shrink-0">
              {/* Connected cards carry their state in the VerificationRow's
                  chip (bottom band) — rendering it here too reads as two
                  disagreeing chips. Header chip = pre-connection states only. */}
              {!source.connected ? (
                <StatusChip status={chip.status} label={chip.label} />
              ) : null}
              {/* StatusChip has no coming-soon state (deliberate — six-word
                  vocabulary). Blocked sources show Not connected + the ETA
                  as plain text beside the chip. */}
              {isBlocked ? (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {availability?.eta ?? "Coming soon"}
                </span>
              ) : null}
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-snug truncate">
            {meta.tagline}
          </p>
        </div>
      </div>

      {/* Value prop + unlocks — what connecting this source buys. Checks are
          Gray 70, not blue: blue stays reserved for actions. */}
      <div className="mt-2.5 pt-2.5 border-t border-[#e0e0e0]">
        <p className="text-[12px] text-[#393939] leading-snug">{meta.payoff}</p>
        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
          {meta.unlocks.map((u) => (
            <p
              key={u}
              className="flex items-start gap-1.5 text-[11px] text-foreground/75 leading-snug"
            >
              <Check
                className="w-2.5 h-2.5 mt-0.5 shrink-0 text-[#525252]"
                strokeWidth={2.5}
              />
              <span className="line-clamp-2">{u}</span>
            </p>
          ))}
        </div>
      </div>

      {/* Bottom band — connected cards get the VerificationRow proof line;
          not-yet-connected cards get the "what you'll need" prerequisite. */}
      <div className="mt-2.5 pt-2 border-t border-[#e0e0e0] space-y-2">
        {isConnected ? (
          <>
            {/* Verification — "prove it worked": account + last sync.
                recordSummary ("3,007 residents") is NOT in the hub payload
                this wave, so the prop is deliberately omitted, not faked. */}
            <VerificationRow
              status={chip.status}
              accountLabel={source.accountLabel ?? meta.name}
              lastSyncAt={
                source.lastSyncAt ? formatSyncDate(source.lastSyncAt) : undefined
              }
            />
            {/* Health note — one-line yellow action link when a connected
                source isn't fully green (e.g. AppFolio auto-sync paused). */}
            {source.healthNote ? (
              <Link
                href={source.healthNote.href}
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#f1c21b]/60 bg-[rgba(241,194,27,0.16)] px-2 py-1 text-[11px] font-medium text-[#8a6d00] hover:bg-[rgba(241,194,27,0.24)] transition-colors"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[#f1c21b]"
                />
                {source.healthNote.label}
                <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            ) : null}
          </>
        ) : null}

        {/* Prerequisite line — what you'll need + realistic time-to-connect.
            Hidden once connected or when the source is blocked. When a
            request is already on file (provisioning), the line flips to the
            persisted status copy instead of re-asking for prerequisites. */}
        {!isConnected && !isBlocked ? (
          <p className="text-[11px] text-[#525252] leading-snug">
            {source.provisioning
              ? "Requested — provisioning (≤4 business hrs). We'll email you when it's live."
              : PREREQUISITES[source.id]}
          </p>
        ) : null}

        {/* Blocked rationale — when the agency hasn't finished the
            provider setup, explain why and what happens next. Keeps the
            operator from clicking into a 503. */}
        {isBlocked && availability?.reason ? (
          <p className="text-[11px] text-muted-foreground leading-snug">
            {availability.reason}
          </p>
        ) : null}

        {/* Soft "missing downstream token" note — for sources that are
            OAuth-ready (so Connect is live) but where the downstream API
            token env var isn't set on this deploy (Google Ads developer
            token, Meta Marketing Standard Access). Google Ads Basic
            Access landed 2026-06-01 so prod no longer surfaces this for
            google_ads; left in place for parity with meta_ads + safety
            on misconfigured deploys. Stale-toned (Carbon yellow family). */}
        {!isBlocked && !isConnected && availability?.reason ? (
          <p className="inline-flex items-start gap-1.5 rounded-[2px] bg-[rgba(241,194,27,0.16)] px-2 py-1 text-[11px] text-[#8a6d00] leading-snug">
            <Clock className="w-2.5 h-2.5 mt-0.5 shrink-0" strokeWidth={1.75} />
            <span>{availability.reason}</span>
          </p>
        ) : null}

        {/* Scope disclosure — only the two ads sources, whose OAuth scopes
            are write-capable and therefore excluded from the footer's
            "read-only" claim. */}
        {scopeNote ? (
          <p className="text-[10px] text-[#6f6f6f] leading-snug">{scopeNote}</p>
        ) : null}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {isConnected ? (
            <>
              {/* Norman bug #105: when AppFolio is connected, surface
                  "Sync now" directly on the connect card instead of
                  making operators drill into Settings → Integrations to
                  find it. The button hits the existing
                  triggerAppfolioSync server action and refreshes the
                  page. Only renders for AppFolio (other sources use
                  the upstream OAuth flow's own refresh path). */}
              {source.id === "appfolio" ? (
                <RunAppFolioSyncButton label="Sync now" subtle />
              ) : null}
              <Link
                href={connectHref}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
              >
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </>
          ) : isBlocked ? (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-none bg-muted text-muted-foreground text-[12px] font-semibold cursor-not-allowed"
            >
              <Clock className="w-3 h-3" />
              Not yet available
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-none bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark disabled:opacity-40 transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {meta.connectLabel ? `${meta.connectLabel}…` : "Connecting…"}
                </>
              ) : (
                <>
                  {meta.inline ? (
                    <Plus className="w-3 h-3" />
                  ) : (
                    <ExternalLink className="w-3 h-3" />
                  )}
                  {/* A source with a request on file routes back into its
                      setup surface to finish/inspect, not "Request" again. */}
                  {source.provisioning
                    ? "Resume setup"
                    : (meta.connectLabel ?? "Connect")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
