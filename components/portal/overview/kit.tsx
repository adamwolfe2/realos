import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BRAND_LOGOS } from "@/components/portal/integrations/brand-logos";

// Overview kit: calm white panels with a hairline edge, quiet type. Status is
// a small coloured dot beside navy text, never a filled pastel pill; colour
// is reserved for meaning, blue for action.

export type Tone = "neutral" | "good" | "bad" | "warn" | "brand" | "ai";

const DOT: Record<Tone, string> = {
  neutral: "#94a0b8",
  good: "#16a34a",
  bad: "#dc2626",
  warn: "#d97706",
  brand: "#1f5eff",
  ai: "#1f5eff",
};
const DELTA_TEXT: Record<Tone, string> = {
  neutral: "text-[var(--t-muted)]",
  good: "text-[#15803d]",
  bad: "text-[#b91c1c]",
  warn: "text-[#b45309]",
  brand: "text-[var(--t-accent)]",
  ai: "text-[var(--t-accent)]",
};

export function Panel({ title, aside, children, className, flush }: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn("min-w-0 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] shadow-[var(--t-shadow)]", className)}>
      {title ? (
        <header className="flex h-12 items-center justify-between gap-3 border-b border-[var(--t-divider)] px-4">
          <h2 className="text-[13.5px] font-semibold text-[var(--t-ink)]">{title}</h2>
          {aside ? <div className="flex shrink-0 items-center gap-3 text-[12.5px] text-[var(--t-muted)]">{aside}</div> : null}
        </header>
      ) : null}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium tabular-nums text-[var(--t-text)]">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[tone] }} />
      {children}
    </span>
  );
}

export function Metric({ label, value, delta, note }: { label: string; value: ReactNode; delta?: { text: string; tone: Tone } | null; note?: string }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <dt className="text-[12.5px] text-[var(--t-muted)]">{label}</dt>
      <dd className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--t-ink)]">{value}</span>
        {delta ? <span className={cn("text-[12.5px] font-medium tabular-nums", DELTA_TEXT[delta.tone])}>{delta.text}</span> : null}
      </dd>
      {note ? <p className="mt-1.5 text-[12px] text-[var(--t-muted)]">{note}</p> : null}
    </div>
  );
}

export function Logo({ slug, size = 14 }: { slug: string; size?: number }) {
  const logo = BRAND_LOGOS[slug];
  if (!logo) return null;
  return (
    <span className="inline-flex shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-contain" style={{ width: size, height: size, color: logo.brandColor, fill: logo.brandColor }}>
      {logo.render()}
    </span>
  );
}

/** One neutral avatar style for every person and property initial. */
export function Initial({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full border border-[var(--t-border)] bg-[var(--t-wash)] font-semibold text-[var(--t-text)]" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** Numbered step title for setup panels. */
export function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--t-wash)] text-[11px] font-semibold tabular-nums text-[var(--t-text)]">{n}</span>
      {children}
    </span>
  );
}

/** Signed % change with a tone; null when there is no baseline. */
export function change(now: number, prior: number, upIsGood = true): { text: string; tone: Tone } | null {
  if (!prior) return null;
  const pct = Math.round(((now - prior) / prior) * 100);
  if (pct === 0) return { text: "flat", tone: "neutral" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct > 0 === upIsGood ? "good" : "bad" };
}

export function ago(d: Date, now: number): string {
  const m = Math.max(1, Math.round((now - d.getTime()) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
