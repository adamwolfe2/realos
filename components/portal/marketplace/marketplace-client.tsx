"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  Bot,
  TrendingUp,
  BarChart3,
  Send,
  Share2,
  Brush,
  Globe,
  Mail,
  Star,
  Users,
  Sparkles,
  Check,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SectionLabel } from "@/components/portal/ui/section-label";
import {
  MetaMark,
  GoogleMark,
  TikTokMark,
  SlackMark,
  CalcomMark,
  ResendMark,
  GA4Mark,
  AppFolioMark,
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
  LinkedInMark,
  VercelMark,
  FigmaMark,
} from "@/components/platform/artifacts/brand-logos";

// Maps the catalog's brandLogoKeys strings to the actual SVG components.
// Keeps the catalog server-safe (no React imports) while letting the
// marketplace render real brand marks per module — no more generic lucide
// icons standing in for "Google" or "Meta".
const LOGO_MAP: Record<string, (props: { size?: number }) => React.JSX.Element> = {
  google: GoogleMark,
  meta: MetaMark,
  tiktok: TikTokMark,
  linkedin: LinkedInMark,
  slack: SlackMark,
  claude: ClaudeMark,
  chatgpt: ChatGPTMark,
  perplexity: PerplexityMark,
  gemini: GeminiMark,
  appfolio: AppFolioMark,
  ga4: GA4Mark,
  vercel: VercelMark,
  figma: FigmaMark,
  cal: CalcomMark,
  resend: ResendMark,
};

// ---------------------------------------------------------------------------
// Marketplace — premium, brand-consistent, honest about what's shipped.
//
// Five card kinds:
//   toggle    — true self-serve flippable Boolean (Pixel, Chatbot,
//               Referrals). Free during trial; routes to billing post-trial.
//   included  — always-on (Lead Capture, Reputation Monitoring). Pill +
//               "Use it" deep-link, no toggle.
//   concierge — managed service our team delivers (Google Ads, Meta Ads,
//               Creative Studio, Hosted Site, SEO/AEO, White-label). No
//               toggle — clicks "Request setup" and we get on a call.
//               Honest framing of what's not self-serve today.
//   addon     — paid Stripe SKU (Reputation Pro). Routes to billing for
//               checkout regardless of trial state.
//   coming    — coming soon (Email Nurture, Outbound Email). Greyed,
//               "Notify me", non-activatable. Honest > overpromise.
//
// Single LeaseStack accent (#2563EB / theme.primary) is the only colour
// that ever signals state. No greens, ambers, per-module rainbows. Each
// card renders the actual brand logos for the tools it integrates with
// (Google, Meta, Claude, AppFolio, etc.) so operators see the stack at
// a glance instead of a lucide silhouette.
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Eye,
  Bot,
  TrendingUp,
  BarChart3,
  Send,
  Share2,
  Brush,
  Globe,
  Mail,
  Star,
  Users,
  Sparkles,
};

type CatalogEntryKind =
  | "toggle"
  | "included"
  | "concierge"
  | "addon"
  | "coming";

type MarketplaceEntryVM = {
  key: string;
  kind: CatalogEntryKind;
  slug: string;
  name: string;
  tagline: string;
  bullets: string[];
  monthlyPriceCents: number;
  setupHref: string;
  popular: boolean;
  setupEffort: string | null;
  iconName: string;
  brandLogoKeys: string[];
};

type GroupVM = {
  category: string;
  modules: MarketplaceEntryVM[];
};

type Props = {
  orgName: string;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  initialEnabled: Record<string, boolean>;
  grouped: GroupVM[];
  /** Module keys that can be flipped via the toggle API (excludes
      included / addon / coming entries). Drives "Unlock everything". */
  allToggleableKeys: string[];
};

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function MarketplaceClient({
  orgName,
  isTrialing,
  trialDaysLeft,
  initialEnabled,
  grouped,
  allToggleableKeys,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(initialEnabled);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState<Set<string>>(new Set());

  // Activated count for the progress bar — counts toggles that are on
  // AND every "included" entry. Coming-soon and add-ons don't count
  // toward "modules active".
  const totalToggleable = allToggleableKeys.length;
  const enabledCount = useMemo(
    () => allToggleableKeys.filter((k) => enabled[k]).length,
    [allToggleableKeys, enabled],
  );

  const toggleModule = useCallback(
    async (moduleKey: string, nextEnabled: boolean) => {
      setError(null);
      setPending((p) => new Set(p).add(moduleKey));
      try {
        const res = await fetch("/api/portal/marketplace/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleKey, enabled: nextEnabled }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
        if (json.requiresPayment) {
          router.push(
            `/portal/billing?addon=${encodeURIComponent(moduleKey)}`,
          );
          return;
        }
        setEnabled((prev) => ({ ...prev, [moduleKey]: nextEnabled }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update module";
        setError(message);
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(moduleKey);
          return next;
        });
      }
    },
    [router],
  );

  const activateAll = useCallback(async () => {
    setError(null);
    setBulkPending(true);
    try {
      const targets = allToggleableKeys.filter((k) => !enabled[k]);
      const results = await Promise.allSettled(
        targets.map((k) =>
          fetch("/api/portal/marketplace/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleKey: k, enabled: true }),
          }).then(async (r) => {
            const j = await r.json();
            if (!r.ok || !j.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
            return { moduleKey: k, requiresPayment: !!j.requiresPayment };
          }),
        ),
      );
      setEnabled((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled" && !r.value.requiresPayment) {
            next[r.value.moduleKey] = true;
          }
        }
        return next;
      });
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setError(
          `${failed} module${failed === 1 ? "" : "s"} couldn't activate. Try again.`,
        );
      }
    } finally {
      setBulkPending(false);
    }
  }, [allToggleableKeys, enabled]);

  return (
    <div className="min-h-screen">
      {/* Header — canonical PageHeader. The marketing voice (serif "Welcome
          to ___. Build your stack.") moved to the marketing site; here the
          header reads as operator chrome. Activation progress sits in a
          right-aligned slot so it stays visible without competing. */}
      <PageHeader
        title="Modules"
        description={
          isTrialing
            ? `Activate any module free for the next ${trialDaysLeft ?? 14} days. Each ships with its own setup — most take 1–10 minutes.`
            : "Bolt on modules whenever you're ready. Each is a standalone subscription you can start, pause, or cancel from billing."
        }
        actions={
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Active
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {enabledCount}
                <span className="text-muted-foreground"> / {totalToggleable}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={activateAll}
              disabled={bulkPending || enabledCount === totalToggleable}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {bulkPending
                ? "Activating…"
                : isTrialing
                  ? "Unlock everything free"
                  : "Activate all"}
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Categories — each group anchored by a SectionLabel for cohesion
          with the rest of the portal (no more serif inline H2s). */}
      <section className="space-y-10">
        {grouped.map((group) =>
          group.modules.length === 0 ? null : (
            <div key={group.category}>
              <SectionLabel
                trailing={`${group.modules.length} module${group.modules.length === 1 ? "" : "s"}`}
              >
                {group.category}
              </SectionLabel>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.modules.map((m) => (
                  <ModuleCard
                    key={m.key}
                    module={m}
                    isEnabled={!!enabled[m.key]}
                    isPending={pending.has(m.key)}
                    isTrialing={isTrialing}
                    isNotified={notified.has(m.key)}
                    onActivate={() => toggleModule(m.key, true)}
                    onDeactivate={() => toggleModule(m.key, false)}
                    onNotifyMe={() =>
                      setNotified((n) => new Set(n).add(m.key))
                    }
                  />
                ))}
              </div>
            </div>
          ),
        )}
      </section>
    </div>
  );
}

function ModuleCard({
  module: m,
  isEnabled,
  isPending,
  isTrialing,
  isNotified,
  onActivate,
  onDeactivate,
  onNotifyMe,
}: {
  module: MarketplaceEntryVM;
  isEnabled: boolean;
  isPending: boolean;
  isTrialing: boolean;
  isNotified: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onNotifyMe: () => void;
}) {
  const Icon = ICON_MAP[m.iconName] ?? Sparkles;
  const isComing = m.kind === "coming";
  const isIncluded = m.kind === "included";
  const isAddon = m.kind === "addon";
  const isToggle = m.kind === "toggle";
  const isConcierge = m.kind === "concierge";

  // Drastically simplified card. Was: icon + title + tagline + 4 bullets
  // + integrates-with row + price + setup-effort + CTA. Read as a feature
  // brochure stacked 11 times. Now: icon + title + status, 1-line
  // tagline, footer row with logos + price + CTA. The bullets and
  // integration list moved to the module detail page (clicked into via
  // CTA). Less work to scan, more visual presence per card.
  // Premium 2026 redesign: tier-coded top stripe (active=green, included=blue,
  // concierge=amber, coming=muted), layered card depth via .ls-card, slightly
  // larger icon chip with gradient.
  const stripeColor =
    isComing
      ? "transparent"
      : isConcierge
        ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
        : isEnabled
          ? "linear-gradient(90deg, #16a34a, #4ade80)"
          : isIncluded
            ? "linear-gradient(90deg, #2563EB, #60A5FA)"
            : isAddon
              ? "linear-gradient(90deg, #7c3aed, #a78bfa)"
              : "transparent";

  return (
    <article
      className={[
        "ls-card relative p-5 flex flex-col overflow-hidden",
        isComing ? "opacity-80" : "",
      ].join(" ")}
      style={{ minHeight: 144 }}
    >
      {/* Top accent stripe — pure CSS so it survives hover and never shifts. */}
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: stripeColor }}
      />
      {/* Header — icon + title + status pill */}
      <div className="flex items-start gap-3">
        <div
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ring-1 ring-inset"
          style={{
            background:
              "linear-gradient(180deg, rgba(37,99,235,0.10), rgba(37,99,235,0.04))",
            color: "var(--terracotta)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
            opacity: isComing ? 0.6 : 1,
          }}
        >
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold tracking-tight text-foreground truncate">
              {m.name}
            </h3>
            <StatusPill kind={m.kind} isEnabled={isEnabled} popular={m.popular} />
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground line-clamp-2">
            {m.tagline}
          </p>
        </div>
      </div>

      {/* Footer — flex-end aligned. Logos + price on the left, CTA on the
          right. No bullets, no separators, no "INTEGRATES WITH" label —
          the logos speak for themselves at this size. */}
      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {m.brandLogoKeys && m.brandLogoKeys.length > 0 ? (
            <div className="flex items-center gap-1 shrink-0">
              {m.brandLogoKeys.slice(0, 4).map((k) => {
                const Logo = LOGO_MAP[k];
                if (!Logo) return null;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center justify-center opacity-80"
                    title={k}
                  >
                    <Logo size={13} />
                  </span>
                );
              })}
            </div>
          ) : null}
          {m.brandLogoKeys && m.brandLogoKeys.length > 0 ? (
            <span aria-hidden="true" className="text-border">·</span>
          ) : null}
          <PriceLine
            kind={m.kind}
            isEnabled={isEnabled}
            isTrialing={isTrialing}
            cents={m.monthlyPriceCents}
          />
        </div>
        <CtaRow
          kind={m.kind}
          isEnabled={isEnabled}
          isPending={isPending}
          isTrialing={isTrialing}
          isNotified={isNotified}
          setupHref={m.setupHref}
          name={m.name}
          isToggle={isToggle}
          isAddon={isAddon}
          isIncluded={isIncluded}
          isComing={isComing}
          onActivate={onActivate}
          onDeactivate={onDeactivate}
          onNotifyMe={onNotifyMe}
        />
      </div>
    </article>
  );
}

function StatusPill({
  kind,
  isEnabled,
  popular,
}: {
  kind: CatalogEntryKind;
  isEnabled: boolean;
  popular: boolean;
}) {
  if (kind === "included") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary shrink-0">
        <Check className="w-2.5 h-2.5" />
        Included
      </span>
    );
  }
  if (kind === "coming") {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        Coming soon
      </span>
    );
  }
  if (kind === "addon") {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-primary shrink-0">
        Pro add-on
      </span>
    );
  }
  if (kind === "concierge") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        <Sparkles className="w-2.5 h-2.5" />
        Concierge
      </span>
    );
  }
  if (isEnabled) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary shrink-0">
        <Check className="w-2.5 h-2.5" />
        Active
      </span>
    );
  }
  if (popular) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        Popular
      </span>
    );
  }
  return null;
}

function PriceLine({
  kind,
  isEnabled,
  isTrialing,
  cents,
}: {
  kind: CatalogEntryKind;
  isEnabled: boolean;
  isTrialing: boolean;
  cents: number;
}) {
  if (kind === "included") {
    return (
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
        Included free
      </p>
    );
  }
  if (kind === "coming") {
    return (
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Coming soon
      </p>
    );
  }
  if (kind === "addon") {
    return (
      <p className="text-[13px] font-semibold tabular-nums text-foreground">
        +{formatPrice(cents)}
        <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
      </p>
    );
  }
  if (kind === "concierge") {
    return (
      <p className="text-[13px] font-semibold tabular-nums text-foreground">
        from {formatPrice(cents)}
        <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
      </p>
    );
  }
  // toggle
  if (isTrialing && !isEnabled) {
    return (
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Free during trial
      </p>
    );
  }
  return (
    <p className="text-[13px] font-semibold tabular-nums text-foreground">
      {formatPrice(cents)}
      <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
    </p>
  );
}

function CtaRow({
  kind,
  isEnabled,
  isPending,
  isTrialing,
  isNotified,
  setupHref,
  name,
  isToggle,
  isAddon,
  isIncluded,
  isComing,
  onActivate,
  onDeactivate,
  onNotifyMe,
}: {
  kind: CatalogEntryKind;
  isEnabled: boolean;
  isPending: boolean;
  isTrialing: boolean;
  isNotified: boolean;
  setupHref: string;
  name: string;
  isToggle: boolean;
  isAddon: boolean;
  isIncluded: boolean;
  isComing: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onNotifyMe: () => void;
}) {
  void kind;
  // Coming soon — non-activatable, soft "Notify me" capture.
  if (isComing) {
    return (
      <button
        type="button"
        onClick={onNotifyMe}
        disabled={isNotified}
        className="inline-flex items-center justify-center h-7 px-3 rounded-md border border-border bg-card text-muted-foreground text-[12px] font-medium hover:border-primary hover:text-primary disabled:opacity-60 disabled:cursor-default transition-colors"
      >
        {isNotified ? "Notified" : "Notify me"}
      </button>
    );
  }
  // Included — straight to the page.
  if (isIncluded) {
    return (
      <Link
        href={setupHref}
        className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark transition-colors"
      >
        Open <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  // Pro add-on — always Stripe checkout via billing page.
  if (isAddon) {
    return (
      <Link
        href={setupHref}
        className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark transition-colors"
      >
        Add <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  // Concierge — managed service, no toggle. "Request setup" routes to the
  // marketplace with a request= query param the operator can post about.
  // Honest UX: this is NOT instant, our team has to wire it up.
  if (kind === "concierge") {
    return (
      <Link
        href={setupHref}
        className="inline-flex items-center gap-1 h-7 px-3 rounded-md border border-primary text-primary text-[12px] font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        Request setup <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  // Toggle, already on — Set up + Remove.
  if (isToggle && isEnabled) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href={setupHref}
          className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark transition-colors"
        >
          Set up <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          type="button"
          onClick={onDeactivate}
          disabled={isPending}
          className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          aria-label={`Deactivate ${name}`}
        >
          {isPending ? "…" : "Remove"}
        </button>
      </div>
    );
  }
  // Toggle, off — Activate.
  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={isPending}
      className="inline-flex items-center justify-center h-7 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark disabled:opacity-40 transition-colors"
    >
      {isPending ? "…" : isTrialing ? "Activate" : "Unlock"}
    </button>
  );
}
