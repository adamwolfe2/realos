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
  Sparkles,
  Check,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Marketplace — premium, brand-consistent.
//
// Design system locked to LeaseStack's monochrome + single-accent palette.
// No greens, ambers, magentas, per-module colours — every accent uses
// the brand blue #2563EB. Activated state is a subtle blue-tinted card,
// not a green border. Buttons are either solid brand-blue (primary
// action) or ghost-bordered foreground (secondary). Card iconography
// is rendered in a uniform soft-blue square so the shelf reads as a
// single product surface, not a scrapbook of integrations.
// ---------------------------------------------------------------------------

// Match the strings emitted by app/portal/marketplace/page.tsx → iconNameFor().
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
  Sparkles,
};

// Single source of truth for accent. Anywhere you'd reach for a colour,
// reach for one of these tokens instead.
const BRAND = {
  blue: "#2563EB",
  blueHover: "#1D4ED8",
  blueTint: "#EFF6FF",
  blueTintBorder: "#DBEAFE",
  ink: "#0A0A0A",
  inkSoft: "#393C41",
  muted: "#5C5E62",
  mutedSoft: "#8E8E8E",
  border: "#E5E5E5",
  borderSoft: "#EEEEEE",
  borderHair: "#F4F4F4",
  surface: "#FFFFFF",
  canvas: "#FAFAF7",
} as const;

type MarketplaceModuleVM = {
  key: string;
  slug: string;
  name: string;
  tagline: string;
  bullets: string[];
  monthlyPriceCents: number;
  setupHref: string;
  popular: boolean;
  iconName: string;
};

type GroupVM = {
  category: string;
  modules: MarketplaceModuleVM[];
};

type Props = {
  orgName: string;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  initialEnabled: Record<string, boolean>;
  grouped: GroupVM[];
  allModuleKeys: string[];
};

function formatPrice(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function MarketplaceClient({
  orgName,
  isTrialing,
  trialDaysLeft,
  initialEnabled,
  grouped,
  allModuleKeys,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(initialEnabled);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledCount = useMemo(
    () => Object.values(enabled).filter(Boolean).length,
    [enabled],
  );
  const totalCount = allModuleKeys.length;

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
      const targets = allModuleKeys.filter((k) => !enabled[k]);
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
        setError(`${failed} module${failed === 1 ? "" : "s"} couldn't activate. Try again.`);
      }
    } finally {
      setBulkPending(false);
    }
  }, [allModuleKeys, enabled]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.canvas }}>
      {/* Hero */}
      <section
        className="border-b"
        style={{
          backgroundColor: BRAND.surface,
          borderColor: BRAND.borderSoft,
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-12 lg:px-10 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <p
                className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4"
                style={{ color: BRAND.blue }}
              >
                {isTrialing ? "Free during your trial" : "Marketplace"}
              </p>
              <h1
                className="text-[34px] lg:text-[42px] leading-[1.05] tracking-tight font-semibold"
                style={{
                  color: BRAND.ink,
                  fontFamily:
                    "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
                }}
              >
                Welcome to {orgName}.
                <br />
                Build your stack.
              </h1>
              <p
                className="mt-5 text-[15px] leading-relaxed"
                style={{ color: BRAND.muted }}
              >
                {isTrialing
                  ? `Activate any module free for the next ${trialDaysLeft ?? 14} days. Each one ships with its own setup — turn on what you need, skip what you don't.`
                  : "Bolt on additional modules whenever you're ready. Each one is a standalone subscription you can start, pause, or cancel from billing."}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={activateAll}
                  disabled={bulkPending || enabledCount === totalCount}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-md text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: BRAND.blue,
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = BRAND.blueHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = BRAND.blue;
                  }}
                >
                  {bulkPending ? "Activating…" : "Unlock everything"}
                </button>
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-60"
                  style={{ color: BRAND.ink }}
                >
                  Skip for now <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Progress */}
            <div
              className="lg:min-w-[280px] rounded-lg p-5"
              style={{
                backgroundColor: BRAND.canvas,
                border: `1px solid ${BRAND.borderSoft}`,
              }}
            >
              <div className="flex items-baseline justify-between mb-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color: BRAND.muted }}
                >
                  Modules active
                </p>
                <p
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: BRAND.ink }}
                >
                  {enabledCount}
                  <span style={{ color: BRAND.mutedSoft }}>
                    {" "}
                    / {totalCount}
                  </span>
                </p>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: BRAND.borderSoft }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.round((enabledCount / totalCount) * 100)}%`,
                    backgroundColor: BRAND.blue,
                  }}
                />
              </div>
            </div>
          </div>

          {error ? (
            <div
              className="mt-6 rounded-md px-4 py-3 text-sm"
              style={{
                color: BRAND.ink,
                backgroundColor: BRAND.canvas,
                border: `1px solid ${BRAND.border}`,
              }}
            >
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
                  className="text-[22px] tracking-tight font-semibold"
                  style={{
                    color: BRAND.ink,
                    fontFamily:
                      "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
                  }}
                >
                  {group.category}
                </h2>
                <span
                  className="text-[10px] uppercase tracking-[0.15em] font-medium"
                  style={{ color: BRAND.mutedSoft }}
                >
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
                    onActivate={() => toggleModule(m.key, true)}
                    onDeactivate={() => toggleModule(m.key, false)}
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
  onActivate,
  onDeactivate,
}: {
  module: MarketplaceModuleVM;
  isEnabled: boolean;
  isPending: boolean;
  isTrialing: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const Icon = ICON_MAP[m.iconName] ?? Sparkles;

  return (
    <article
      className="relative flex flex-col rounded-lg p-6 transition-all"
      style={{
        backgroundColor: isEnabled ? BRAND.blueTint : BRAND.surface,
        border: `1px solid ${isEnabled ? BRAND.blueTintBorder : BRAND.borderSoft}`,
      }}
    >
      {/* Status pill — single brand-blue token whether activated or popular */}
      {isEnabled ? (
        <span
          className="absolute top-5 right-5 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{
            color: BRAND.blue,
          }}
        >
          <Check className="w-3 h-3" />
          Active
        </span>
      ) : m.popular ? (
        <span
          className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: BRAND.muted }}
        >
          Popular
        </span>
      ) : null}

      {/* Icon — uniform soft-blue tile so the grid reads as a single product surface */}
      <div
        className="inline-flex items-center justify-center w-9 h-9 rounded-md mb-5"
        style={{
          backgroundColor: BRAND.blueTint,
          color: BRAND.blue,
        }}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
      </div>

      {/* Body */}
      <h3
        className="text-[15px] font-semibold mb-2 leading-snug tracking-tight"
        style={{ color: BRAND.ink }}
      >
        {m.name}
      </h3>
      <p
        className="text-[13px] leading-relaxed mb-5"
        style={{ color: BRAND.muted }}
      >
        {m.tagline}
      </p>

      <ul className="space-y-2 mb-6">
        {m.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2.5 text-[12.5px] leading-snug"
            style={{ color: BRAND.inkSoft }}
          >
            <Check
              className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
              style={{ color: BRAND.blue }}
              strokeWidth={2.25}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* Footer: price + CTA */}
      <div
        className="mt-auto pt-5"
        style={{ borderTop: `1px solid ${BRAND.borderHair}` }}
      >
        <div className="flex items-baseline justify-between mb-4">
          {isTrialing && !isEnabled ? (
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: BRAND.muted }}
            >
              Free during trial
            </p>
          ) : (
            <p
              className="text-[18px] font-semibold tabular-nums"
              style={{ color: BRAND.ink }}
            >
              {formatPrice(m.monthlyPriceCents)}
              <span
                className="text-[12px] font-normal"
                style={{ color: BRAND.mutedSoft }}
              >
                {" "}
                /mo
              </span>
            </p>
          )}
        </div>

        {isEnabled ? (
          <div className="flex items-center gap-2">
            <Link
              href={m.setupHref}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: BRAND.blue }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = BRAND.blueHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = BRAND.blue;
              }}
            >
              Set up <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={onDeactivate}
              disabled={isPending}
              className="h-10 px-3 text-xs font-medium transition-opacity hover:opacity-60 disabled:opacity-40"
              style={{ color: BRAND.mutedSoft }}
              aria-label={`Deactivate ${m.name}`}
            >
              {isPending ? "…" : "Remove"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-white text-sm font-semibold disabled:opacity-40 transition-colors"
            style={{ backgroundColor: BRAND.blue }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = BRAND.blueHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BRAND.blue;
            }}
          >
            {isPending
              ? "Activating…"
              : isTrialing
                ? "Activate"
                : "Unlock"}
          </button>
        )}
      </div>
    </article>
  );
}
