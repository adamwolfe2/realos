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
  Clock,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Marketplace — premium, brand-consistent, honest about what's shipped.
//
// Four card kinds:
//   toggle   — flippable Boolean (Pixel, Chatbot, SEO, Ads, Website,
//              Creative, Referrals). Free during trial; routes to billing
//              post-trial.
//   included — always-on (Lead Capture, Reputation Monitoring). Pill +
//              "Use it" deep-link, no toggle.
//   addon    — paid Stripe SKU (Reputation Pro, White-label). Routes to
//              billing for checkout regardless of trial state.
//   coming   — coming soon (Email Nurture, Outbound Email). Greyed,
//              "Notify me", non-activatable. Honest > overpromise.
//
// Single LeaseStack accent (#2563EB / theme.primary) is the only colour
// that ever signals state. No greens, ambers, per-module rainbows.
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

type CatalogEntryKind = "toggle" | "included" | "addon" | "coming";

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
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Hero */}
      <section className="border-b border-[#EEEEEE] bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-12 lg:px-10 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary mb-4">
                {isTrialing ? "Free during your trial" : "Marketplace"}
              </p>
              <h1
                className="text-[34px] lg:text-[42px] leading-[1.05] tracking-tight font-semibold text-[#0A0A0A]"
                style={{
                  fontFamily:
                    "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
                }}
              >
                Welcome to {orgName}.
                <br />
                Build your stack.
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed text-[#5C5E62]">
                {isTrialing
                  ? `Activate any module free for the next ${trialDaysLeft ?? 14} days. Each one ships with its own setup — most take 1–10 minutes to get value from.`
                  : "Bolt on additional modules whenever you're ready. Each is a standalone subscription you can start, pause, or cancel from billing."}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={activateAll}
                  disabled={bulkPending || enabledCount === totalToggleable}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkPending ? "Activating…" : "Unlock everything free"}
                </button>
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0A0A0A] transition-opacity hover:opacity-60"
                >
                  Skip for now <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="lg:min-w-[280px] rounded-lg border border-[#EEEEEE] bg-[#FAFAF7] p-5">
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5C5E62]">
                  Modules active
                </p>
                <p className="text-sm font-semibold tabular-nums text-[#0A0A0A]">
                  {enabledCount}
                  <span className="text-[#8E8E8E]"> / {totalToggleable}</span>
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-[#EEEEEE] overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width: `${Math.round((enabledCount / Math.max(1, totalToggleable)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-md border border-[#E5E5E5] bg-[#FAFAF7] px-4 py-3 text-sm text-[#0A0A0A]">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-[1200px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
        {grouped.map((group) =>
          group.modules.length === 0 ? null : (
            <div key={group.category} className="mb-14 last:mb-0">
              <div className="flex items-baseline justify-between mb-6">
                <h2
                  className="text-[22px] tracking-tight font-semibold text-[#0A0A0A]"
                  style={{
                    fontFamily:
                      "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
                  }}
                >
                  {group.category}
                </h2>
                <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-[#8E8E8E]">
                  {group.modules.length} module
                  {group.modules.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

  return (
    <article
      className="relative flex flex-col rounded-lg p-6 transition-all"
      style={{
        backgroundColor: isComing
          ? "#FAFAF7"
          : isEnabled || isIncluded
            ? "#EFF6FF"
            : "#FFFFFF",
        border: `1px solid ${
          isComing
            ? "#EEEEEE"
            : isEnabled || isIncluded
              ? "#DBEAFE"
              : "#EEEEEE"
        }`,
        opacity: isComing ? 0.85 : 1,
      }}
    >
      {/* Status pill — single brand-blue token across every kind */}
      <StatusPill
        kind={m.kind}
        isEnabled={isEnabled}
        popular={m.popular}
      />

      {/* Icon — uniform soft-blue tile */}
      <div
        className="inline-flex items-center justify-center w-9 h-9 rounded-md mb-5 bg-primary/10 text-primary"
        style={isComing ? { opacity: 0.6 } : undefined}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
      </div>

      {/* Body */}
      <h3 className="text-[15px] font-semibold mb-2 leading-snug tracking-tight text-[#0A0A0A]">
        {m.name}
      </h3>
      <p className="text-[13px] leading-relaxed mb-5 text-[#5C5E62]">
        {m.tagline}
      </p>

      <ul className="space-y-2 mb-6">
        {m.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2.5 text-[12.5px] leading-snug text-[#393C41]"
          >
            <Check
              className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary"
              strokeWidth={2.25}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* Footer: price + CTA */}
      <div className="mt-auto pt-5 border-t border-[#F4F4F4]">
        <div className="flex items-baseline justify-between mb-3">
          <PriceLine
            kind={m.kind}
            isEnabled={isEnabled}
            isTrialing={isTrialing}
            cents={m.monthlyPriceCents}
          />
        </div>

        {/* Setup-effort hint — sets expectations for time-to-value */}
        {m.setupEffort ? (
          <p className="flex items-center gap-1.5 text-[11px] text-[#8E8E8E] mb-4">
            <Clock className="w-3 h-3" />
            {m.setupEffort}
          </p>
        ) : null}

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
      <span className="absolute top-5 right-5 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
        <Check className="w-3 h-3" />
        Included
      </span>
    );
  }
  if (kind === "coming") {
    return (
      <span className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8E8E8E]">
        Coming soon
      </span>
    );
  }
  if (kind === "addon") {
    return (
      <span className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
        Pro add-on
      </span>
    );
  }
  if (isEnabled) {
    return (
      <span className="absolute top-5 right-5 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
        <Check className="w-3 h-3" />
        Active
      </span>
    );
  }
  if (popular) {
    return (
      <span className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5C5E62]">
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
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
        Included free
      </p>
    );
  }
  if (kind === "coming") {
    return (
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8E8E8E]">
        Coming soon
      </p>
    );
  }
  if (kind === "addon") {
    return (
      <p className="text-[18px] font-semibold tabular-nums text-[#0A0A0A]">
        +{formatPrice(cents)}
        <span className="text-[12px] font-normal text-[#8E8E8E]"> /mo</span>
      </p>
    );
  }
  // toggle
  if (isTrialing && !isEnabled) {
    return (
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5C5E62]">
        Free during trial
      </p>
    );
  }
  return (
    <p className="text-[18px] font-semibold tabular-nums text-[#0A0A0A]">
      {formatPrice(cents)}
      <span className="text-[12px] font-normal text-[#8E8E8E]"> /mo</span>
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
        className="w-full inline-flex items-center justify-center h-10 rounded-md border border-[#E5E5E5] bg-white text-[#5C5E62] text-sm font-medium hover:border-primary hover:text-primary disabled:opacity-60 disabled:cursor-default transition-colors"
      >
        {isNotified ? "We'll notify you" : "Notify me when ready"}
      </button>
    );
  }
  // Included — straight to the page.
  if (isIncluded) {
    return (
      <Link
        href={setupHref}
        className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark transition-colors"
      >
        Open <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }
  // Pro add-on — always Stripe checkout via billing page.
  if (isAddon) {
    return (
      <Link
        href={setupHref}
        className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark transition-colors"
      >
        Add to plan <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }
  // Toggle, already on — Set up + Remove.
  if (isToggle && isEnabled) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={setupHref}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          Set up <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={onDeactivate}
          disabled={isPending}
          className="h-10 px-3 text-xs font-medium text-[#8E8E8E] transition-opacity hover:opacity-60 disabled:opacity-40"
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
      className="w-full inline-flex items-center justify-center h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark disabled:opacity-40 transition-colors"
    >
      {isPending ? "Activating…" : isTrialing ? "Activate" : "Unlock"}
    </button>
  );
}
