"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowRight, Check, CircleDashed, Clock3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeverityPill, CategoryBadge } from "./severity-pill";
import { acknowledgeInsight, dismissInsight, snoozeInsight, markActed } from "@/app/portal/insights/actions";

export type InsightCardData = {
  id: string;
  kind: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  body: string;
  suggestedAction?: string | null;
  href?: string | null;
  createdAt: Date;
  property?: { id: string; name: string } | null;
  context?: Record<string, unknown> | null;
};

export function InsightCard({
  insight,
  dense,
}: {
  insight: InsightCardData;
  dense?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const fresh = Date.now() - insight.createdAt.getTime() < 6 * 60 * 60 * 1000;
  const acked = insight.status === "acknowledged";

  // Dense mode is the compact card used on dashboards. It strips the four
  // lifecycle action buttons (Acknowledge / Snooze / Dismiss / Mark resolved)
  // because bulk triage belongs on /portal/insights, not inline. Only the
  // primary "Open" deep-link remains so the dashboard reads as scannable
  // signals, not a worklist.
  if (dense) {
    return (
      <article
        className={cn(
          "group relative rounded-lg border bg-card p-3 transition-shadow duration-150 hover:shadow-[0_2px_12px_rgba(0,0,0,0.03)]",
          insight.severity === "critical"
            ? "border-primary/40 bg-primary/[0.03]"
            : insight.severity === "warning"
              ? "border-primary/20"
              : "border-border",
          pending && "opacity-60",
        )}
      >
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <SeverityPill severity={insight.severity} size="sm" />
            {insight.property ? (
              <span className="text-[10px] font-medium text-muted-foreground truncate">
                {insight.property.name}
              </span>
            ) : null}
          </div>
          <time
            className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
            dateTime={insight.createdAt.toISOString()}
            title={insight.createdAt.toLocaleString()}
          >
            {relativeTime(insight.createdAt)}
          </time>
        </header>

        <h3 className="mt-2 text-[13.5px] font-semibold tracking-tight text-foreground leading-snug">
          {insight.title}
        </h3>

        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground line-clamp-2">
          {insight.body}
        </p>

        {insight.href ? (
          <Link
            href={insight.href}
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card transition-shadow duration-150",
        "hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]",
        // Brand-aligned severity scale — single accent (primary) varies
        // by emphasis instead of hue rotation. Critical = filled accent
        // border + tinted bg; warning = subtle accent border; info =
        // neutral.
        insight.severity === "critical"
          ? "border-primary/40 bg-primary/[0.03]"
          : insight.severity === "warning"
            ? "border-primary/20"
            : "border-border",
        "p-4",
        pending && "opacity-60",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <SeverityPill severity={insight.severity} size="md" />
          <CategoryBadge category={insight.category} />
          {insight.property ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              {insight.property.name}
            </span>
          ) : null}
          {fresh ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary ring-1 ring-inset ring-primary/30">
              New
            </span>
          ) : null}
          {acked ? (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
              <CircleDashed className="h-2.5 w-2.5" />
              Acknowledged
            </span>
          ) : null}
        </div>
        <time
          className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
          dateTime={insight.createdAt.toISOString()}
          title={insight.createdAt.toLocaleString()}
        >
          {relativeTime(insight.createdAt)}
        </time>
      </header>

      <h3 className="mt-2 font-semibold tracking-tight text-foreground text-[15px] leading-snug">
        {insight.title}
      </h3>

      <p className="mt-1 text-[13px] leading-relaxed text-foreground">
        {insight.body}
      </p>

      {hasSparkline(insight.context) ? (
        <div className="mt-3">
          <InsightSparkline
            data={(insight.context as { sparkline: number[] }).sparkline}
            severity={insight.severity}
          />
        </div>
      ) : null}

      {insight.suggestedAction ? (
        <p className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Suggested. </span>
          {insight.suggestedAction}
        </p>
      ) : null}

      <footer className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!acked ? (
            <ActionBtn
              label="Acknowledge"
              onClick={() => startTransition(() => { void acknowledgeInsight(insight.id); })}
              icon={Check}
            />
          ) : null}
          <ActionBtn
            label="Snooze 24h"
            onClick={() => startTransition(() => { void snoozeInsight(insight.id, 24); })}
            icon={Clock3}
          />
          <ActionBtn
            label="Dismiss"
            onClick={() => startTransition(() => { void dismissInsight(insight.id); })}
            icon={X}
          />
          <ActionBtn
            label="Mark resolved"
            onClick={() => startTransition(() => { void markActed(insight.id); })}
            icon={Check}
            accent
          />
        </div>
        {insight.href ? (
          <Link
            href={insight.href}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:text-primary transition-colors"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </footer>
    </article>
  );
}

function ActionBtn({
  label,
  onClick,
  icon: Icon,
  accent,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors",
        accent
          ? "text-primary hover:bg-[var(--accent-wash)]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      title={label}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function hasSparkline(context: Record<string, unknown> | null | undefined): boolean {
  if (!context) return false;
  const s = context.sparkline;
  return Array.isArray(s) && s.length > 1 && s.every((n) => typeof n === "number");
}

function InsightSparkline({
  data,
  severity,
}: {
  data: number[];
  severity: string;
}) {
  const stroke =
    severity === "critical" ? "#b91c1c" : severity === "warning" ? "#b45309" : "#2563EB";
  const fill =
    severity === "critical"
      ? "rgba(185, 28, 28, 0.08)"
      : severity === "warning"
        ? "rgba(180, 83, 9, 0.08)"
        : "rgba(37, 99, 235, 0.08)";

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 36;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-9 overflow-visible"
      aria-hidden="true"
    >
      <path
        d={`M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`}
        fill={fill}
      />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
