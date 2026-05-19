"use client";

import { useCallback, useState } from "react";
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

// ---------------------------------------------------------------------------
// WelcomeMarketplaceGrid — client component
//
// Module grid rendered inside the first-run /portal welcome landing. Uses
// the same activation endpoint as /portal/marketplace
// (POST /api/portal/marketplace/toggle) so behaviour is identical:
//   - Toggle modules: POST → flip flag → refresh router so the page now
//     resolves to the regular dashboard (first-run is over).
//   - Concierge / Included / Coming-soon entries get their respective
//     deep-link CTAs (no toggle, no API call).
//
// This is a stripped-down twin of components/portal/marketplace/
// marketplace-client.tsx — single column-friendly cards, no progress
// bar, no "Activate all". The user picks 1-2 things on day one; the
// rich management UI lives at /portal/marketplace.
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

export type WelcomeEntryVM = {
  key: string;
  kind: "toggle" | "included" | "concierge" | "addon" | "coming";
  slug: string;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  setupHref: string;
  popular: boolean;
  setupEffort: string | null;
  iconName: string;
};

type Props = {
  isTrialing: boolean;
  trialDaysLeft: number | null;
  modules: WelcomeEntryVM[];
};

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function WelcomeMarketplaceGrid({
  isTrialing,
  trialDaysLeft,
  modules,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const activate = useCallback(
    async (moduleKey: string) => {
      setError(null);
      setPending((p) => new Set(p).add(moduleKey));
      try {
        const res = await fetch("/api/portal/marketplace/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleKey, enabled: true }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
        if (json.requiresPayment) {
          router.push(`/portal/billing?addon=${encodeURIComponent(moduleKey)}`);
          return;
        }
        // Activation flipped a Boolean — the next /portal load will now
        // detect activatedModuleCount > 0 and render the real dashboard.
        // router.refresh() re-runs the server component and re-evaluates
        // the first-run signal, so the user transitions out of the
        // welcome landing the moment the toggle confirms.
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to activate module";
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

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {modules.map((m) => (
          <WelcomeModuleCard
            key={m.key}
            module={m}
            isPending={pending.has(m.key)}
            isTrialing={isTrialing}
            trialDaysLeft={trialDaysLeft}
            onActivate={() => activate(m.key)}
          />
        ))}
      </div>
    </div>
  );
}

function WelcomeModuleCard({
  module: m,
  isPending,
  isTrialing,
  trialDaysLeft,
  onActivate,
}: {
  module: WelcomeEntryVM;
  isPending: boolean;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  onActivate: () => void;
}) {
  const Icon = ICON_MAP[m.iconName] ?? Sparkles;
  const isComing = m.kind === "coming";
  const isIncluded = m.kind === "included";
  const isAddon = m.kind === "addon";
  const isToggle = m.kind === "toggle";
  const isConcierge = m.kind === "concierge";

  return (
    <article
      className={[
        "ls-card relative p-5 flex flex-col overflow-hidden",
        isComing ? "opacity-70" : "",
      ].join(" ")}
      style={{ minHeight: 168 }}
    >
      <div className="flex items-start gap-3">
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ring-1 ring-inset ring-border"
          style={{
            background:
              "linear-gradient(180deg, rgba(37,99,235,0.10), rgba(37,99,235,0.04))",
            color: "var(--primary, #2563EB)",
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
            <WelcomeStatusPill kind={m.kind} popular={m.popular} />
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground line-clamp-3">
            {m.tagline}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
        <WelcomePriceLine
          kind={m.kind}
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          cents={m.monthlyPriceCents}
        />
        <WelcomeCta
          isToggle={isToggle}
          isAddon={isAddon}
          isIncluded={isIncluded}
          isComing={isComing}
          isConcierge={isConcierge}
          isPending={isPending}
          isTrialing={isTrialing}
          setupHref={m.setupHref}
          onActivate={onActivate}
        />
      </div>
    </article>
  );
}

function WelcomeStatusPill({
  kind,
  popular,
}: {
  kind: WelcomeEntryVM["kind"];
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
  if (popular) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        Popular
      </span>
    );
  }
  return null;
}

function WelcomePriceLine({
  kind,
  isTrialing,
  trialDaysLeft,
  cents,
}: {
  kind: WelcomeEntryVM["kind"];
  isTrialing: boolean;
  trialDaysLeft: number | null;
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
        <span className="text-[11px] font-normal text-muted-foreground">
          /mo
        </span>
      </p>
    );
  }
  if (kind === "concierge") {
    return (
      <p className="text-[13px] font-semibold tabular-nums text-foreground">
        from {formatPrice(cents)}
        <span className="text-[11px] font-normal text-muted-foreground">
          /mo
        </span>
      </p>
    );
  }
  if (isTrialing) {
    return (
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Free for{" "}
        {trialDaysLeft != null && trialDaysLeft > 0
          ? `${trialDaysLeft} days`
          : "your trial"}
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

function WelcomeCta({
  isToggle,
  isAddon,
  isIncluded,
  isComing,
  isConcierge,
  isPending,
  isTrialing,
  setupHref,
  onActivate,
}: {
  isToggle: boolean;
  isAddon: boolean;
  isIncluded: boolean;
  isComing: boolean;
  isConcierge: boolean;
  isPending: boolean;
  isTrialing: boolean;
  setupHref: string;
  onActivate: () => void;
}) {
  if (isComing) {
    return (
      <span className="inline-flex items-center text-[12px] font-medium text-muted-foreground">
        Coming soon
      </span>
    );
  }
  if (isIncluded) {
    return (
      <Link
        href={setupHref}
        className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark transition-colors"
      >
        Open <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  if (isAddon) {
    return (
      <Link
        href={setupHref}
        className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark transition-colors"
      >
        Add <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  if (isConcierge) {
    return (
      <Link
        href={setupHref}
        className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-primary text-primary text-[12px] font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        Request setup <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }
  if (isToggle) {
    return (
      <button
        type="button"
        onClick={onActivate}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary-dark disabled:opacity-40 transition-colors"
      >
        {isPending ? "Activating…" : isTrialing ? "Activate" : "Unlock"}
        {!isPending ? <ArrowRight className="w-3 h-3" /> : null}
      </button>
    );
  }
  return null;
}
