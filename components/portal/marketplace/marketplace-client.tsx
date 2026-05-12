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
  ShoppingCart,
  Lock,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

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

type MarketplaceModuleVM = {
  key: string;
  slug: string;
  name: string;
  tagline: string;
  bullets: string[];
  monthlyPriceCents: number;
  setupHref: string;
  accentColor: string;
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
  // Cart = modules the user has clicked "Add to plan" on but hasn't yet
  // confirmed via "Activate selected". During trial we autoflip on click,
  // so the cart is mostly a UX affordance for the bulk activation flow.
  const [cart, setCart] = useState<Set<string>>(new Set());
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
          // After-trial activation — kick the user to billing so they can
          // pay for the add-on. The webhook flips the flag on success.
          router.push(
            `/portal/billing?addon=${encodeURIComponent(moduleKey)}`,
          );
          return;
        }
        setEnabled((prev) => ({ ...prev, [moduleKey]: nextEnabled }));
        // Auto-clear from cart once activated.
        if (nextEnabled) {
          setCart((c) => {
            const next = new Set(c);
            next.delete(moduleKey);
            return next;
          });
        }
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

  const addToCart = useCallback((moduleKey: string) => {
    setCart((c) => new Set(c).add(moduleKey));
  }, []);

  const removeFromCart = useCallback((moduleKey: string) => {
    setCart((c) => {
      const next = new Set(c);
      next.delete(moduleKey);
      return next;
    });
  }, []);

  // "Activate everything" — flip every disabled module on in parallel.
  // Bounded concurrency would be safer at scale, but with <15 modules we
  // can fan out and let Postgres serialise the writes.
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
      // Mirror server state for everything that succeeded without payment.
      setEnabled((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled" && !r.value.requiresPayment) {
            next[r.value.moduleKey] = true;
          }
        }
        return next;
      });
      setCart(new Set());
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setError(`${failed} module${failed === 1 ? "" : "s"} couldn't activate. Try again.`);
      }
    } finally {
      setBulkPending(false);
    }
  }, [allModuleKeys, enabled]);

  // Activate just what's in the cart.
  const activateCart = useCallback(async () => {
    if (cart.size === 0) return;
    setBulkPending(true);
    try {
      const targets = Array.from(cart);
      await Promise.allSettled(targets.map((k) => toggleModule(k, true)));
    } finally {
      setBulkPending(false);
    }
  }, [cart, toggleModule]);

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Hero */}
      <section className="border-b border-[#EEEEEE] bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-10 lg:px-10 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#2563EB] mb-3">
                {isTrialing ? "Free during your trial" : "Marketplace"}
              </p>
              <h1
                className="text-[34px] lg:text-[40px] leading-[1.1] tracking-tight text-[#0A0A0A] font-semibold"
                style={{
                  fontFamily:
                    "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
                }}
              >
                Welcome to {orgName}.
                <br />
                Build your stack.
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-[#4d4c48]">
                {isTrialing
                  ? `Activate every module free for the next ${trialDaysLeft ?? 14} days. Each one ships with its own setup wizard — turn on what you want, skip what you don't.`
                  : "Bolt on additional modules whenever you're ready. Each one is a standalone subscription you can start, pause, or cancel from the billing portal."}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={activateAll}
                  disabled={bulkPending || enabledCount === totalCount}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkPending ? "Activating…" : "Unlock everything"}
                  <Sparkles className="w-4 h-4" />
                </button>
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0A0A0A] hover:text-[#2563EB] transition-colors"
                >
                  Skip for now <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Progress + cart summary */}
            <div className="lg:min-w-[300px] rounded-xl border border-[#EEEEEE] bg-[#FAFAF7] p-5">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5E62]">
                  Modules activated
                </p>
                <p className="text-sm font-semibold text-[#0A0A0A]">
                  {enabledCount} <span className="text-[#5C5E62]">/ {totalCount}</span>
                </p>
              </div>
              <div className="h-2 rounded-full bg-[#EEEEEE] overflow-hidden">
                <div
                  className="h-full bg-[#2563EB] transition-all duration-500"
                  style={{
                    width: `${Math.round((enabledCount / totalCount) * 100)}%`,
                  }}
                />
              </div>
              {cart.size > 0 ? (
                <div className="mt-4 pt-4 border-t border-[#EEEEEE]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A0A0A]">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {cart.size} in cart
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={activateCart}
                    disabled={bulkPending}
                    className="w-full h-9 rounded-md bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#1f1f1f] disabled:opacity-50 transition-colors"
                  >
                    Activate selected
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b53333]">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-[1200px] mx-auto px-6 lg:px-10 py-10 lg:py-14">
        {grouped.map((group) =>
          group.modules.length === 0 ? null : (
            <div key={group.category} className="mb-12 last:mb-0">
              <div className="flex items-baseline justify-between mb-5">
                <h2
                  className="text-[20px] tracking-tight text-[#0A0A0A] font-semibold"
                  style={{
                    fontFamily:
                      "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
                  }}
                >
                  {group.category}
                </h2>
                <span className="text-[11px] uppercase tracking-wider text-[#8E8E8E]">
                  {group.modules.length} module
                  {group.modules.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {group.modules.map((m) => (
                  <ModuleCard
                    key={m.key}
                    module={m}
                    isEnabled={!!enabled[m.key]}
                    isInCart={cart.has(m.key)}
                    isPending={pending.has(m.key)}
                    isTrialing={isTrialing}
                    onAddToCart={() => addToCart(m.key)}
                    onRemoveFromCart={() => removeFromCart(m.key)}
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
  isInCart,
  isPending,
  isTrialing,
  onAddToCart,
  onRemoveFromCart,
  onActivate,
  onDeactivate,
}: {
  module: MarketplaceModuleVM;
  isEnabled: boolean;
  isInCart: boolean;
  isPending: boolean;
  isTrialing: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const Icon = ICON_MAP[m.iconName] ?? Sparkles;

  return (
    <article
      className="relative flex flex-col rounded-xl border bg-white p-6 transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
      style={{
        borderColor: isEnabled ? "#16A34A" : "#EEEEEE",
        borderWidth: isEnabled ? 1.5 : 1,
      }}
    >
      {/* Status pill */}
      {isEnabled ? (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#15803d]">
          <Check className="w-3 h-3" />
          Activated
        </span>
      ) : m.popular ? (
        <span className="absolute top-4 right-4 inline-flex items-center rounded-full bg-[#dbeafe] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1d4ed8]">
          Popular
        </span>
      ) : null}

      {/* Icon */}
      <div
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
        style={{
          backgroundColor: `${m.accentColor}1A`,
          color: m.accentColor,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Body */}
      <h3 className="text-[16px] font-semibold text-[#0A0A0A] mb-1.5 leading-snug">
        {m.name}
      </h3>
      <p className="text-[13px] leading-relaxed text-[#5C5E62] mb-4">
        {m.tagline}
      </p>

      <ul className="space-y-1.5 mb-5">
        {m.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-[12.5px] text-[#393C41] leading-snug"
          >
            <Check
              className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
              style={{ color: m.accentColor }}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* Price */}
      <div className="mt-auto pt-4 border-t border-[#F4F4F4]">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            {isTrialing && !isEnabled ? (
              <p className="text-[12px] font-semibold text-[#15803d] uppercase tracking-wider">
                Free during trial
              </p>
            ) : (
              <p className="text-[18px] font-semibold text-[#0A0A0A]">
                {formatPrice(m.monthlyPriceCents)}
                <span className="text-[12px] font-normal text-[#8E8E8E]">
                  /mo
                </span>
              </p>
            )}
          </div>
        </div>

        {isEnabled ? (
          <div className="flex items-center gap-2">
            <Link
              href={m.setupHref}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-md border border-[#16A34A] text-[#15803d] text-sm font-semibold hover:bg-[#dcfce7] transition-colors"
            >
              Set up <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={onDeactivate}
              disabled={isPending}
              className="h-10 px-3 rounded-md text-[#8E8E8E] text-xs font-medium hover:text-[#b53333] disabled:opacity-50 transition-colors"
              aria-label={`Deactivate ${m.name}`}
            >
              {isPending ? "…" : "Remove"}
            </button>
          </div>
        ) : isInCart ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onActivate}
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center h-10 rounded-md bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1f1f1f] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Activating…" : "Activate now"}
            </button>
            <button
              type="button"
              onClick={onRemoveFromCart}
              className="h-10 px-3 rounded-md text-[#8E8E8E] text-xs font-medium hover:text-[#0A0A0A] transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onActivate}
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
            >
              {isPending ? (
                "Activating…"
              ) : isTrialing ? (
                <>
                  Add to plan <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Unlock
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onAddToCart}
              className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-[#E5E5E5] text-[#5C5E62] hover:text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors"
              aria-label={`Add ${m.name} to cart`}
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
