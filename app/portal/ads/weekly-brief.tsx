import { ChevronDown } from "lucide-react";
import { Panel, Pill } from "@/components/portal/overview/kit";
import type { BriefWeek } from "@/lib/integrations/ads-brief-text";

// Top of /portal/ads: last week vs the week before as bars, one headline,
// up to three one-line decisions. The reasons sit behind a click.

export type WeeklyBriefData = {
  title: string;
  body: string;
  weekStart: string | null;
  decisions: { title: string; why: string }[];
  thisWeek: BriefWeek | null;
  lastWeek: BriefWeek | null;
};

function isWeek(v: unknown): v is BriefWeek {
  const w = v as BriefWeek | null;
  return !!w && typeof w.spendCents === "number" && typeof w.leads === "number";
}

export function parseBriefContext(context: unknown): Omit<WeeklyBriefData, "title" | "body"> {
  const c = (context ?? {}) as { weekStart?: unknown; decisions?: unknown; facts?: { thisWeek?: unknown; lastWeek?: unknown } };
  const decisions = Array.isArray(c.decisions)
    ? c.decisions
        .filter((d): d is { title: string; why: string } => typeof d?.title === "string" && typeof d?.why === "string")
        .slice(0, 3)
    : [];
  return {
    weekStart: typeof c.weekStart === "string" ? c.weekStart : null,
    decisions,
    thisWeek: isWeek(c.facts?.thisWeek) ? c.facts.thisWeek : null,
    lastWeek: isWeek(c.facts?.lastWeek) ? c.facts.lastWeek : null,
  };
}

function weekLabel(iso: string | null): string {
  if (!iso) return "Last week";
  const start = new Date(`${iso}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)}–${fmt(end)}`;
}

const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

function Compare({ label, now, before, fmt }: { label: string; now: number; before: number; fmt: (n: number) => string }) {
  const max = Math.max(now, before, 1);
  const pct = before ? Math.round(((now - before) / before) * 100) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-[var(--t-muted)]">{label}</span>
        {pct !== null && pct !== 0 ? (
          <span className={`text-[12px] font-medium tabular-nums ${pct > 0 ? "text-[#15803d]" : "text-[#b91c1c]"}`}>
            {pct > 0 ? "+" : ""}{pct}%
          </span>
        ) : null}
      </div>
      <div className="text-[20px] font-semibold tabular-nums text-[var(--t-ink)]">{fmt(now)}</div>
      <div className="mt-1.5 space-y-1" aria-label={`${label}: ${fmt(now)} this week, ${fmt(before)} the week before`}>
        <div className="h-1.5 rounded-full bg-[var(--t-accent)]" style={{ width: `${(now / max) * 100}%` }} />
        <div className="h-1.5 rounded-full bg-[#c9d6f5]" style={{ width: `${(before / max) * 100}%` }} />
      </div>
    </div>
  );
}

export function WeeklyBrief({ brief }: { brief: WeeklyBriefData }) {
  const t = brief.thisWeek;
  const l = brief.lastWeek;
  return (
    <Panel
      title="Last week"
      aside={
        <span className="inline-flex items-center gap-2">
          <Pill tone="ai">AI read</Pill>
          <span>{weekLabel(brief.weekStart)}</span>
        </span>
      }
    >
      <p className="text-[15px] font-semibold leading-snug text-[var(--t-ink)]">{brief.title}</p>

      {t && l ? (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Compare label="Spend" now={t.spendCents} before={l.spendCents} fmt={usd} />
          <Compare label="Leads" now={t.leads} before={l.leads} fmt={(n) => n.toLocaleString()} />
          <Compare label="Tours" now={t.tours} before={l.tours} fmt={(n) => n.toLocaleString()} />
          <Compare label="Leases" now={t.signed} before={l.signed} fmt={(n) => n.toLocaleString()} />
        </div>
      ) : null}

      {brief.decisions.length ? (
        <ol className="mt-4 divide-y divide-[var(--t-divider)] border-t border-[var(--t-divider)]">
          {brief.decisions.map((d, i) => (
            <li key={d.title}>
              <details className="group py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--t-accent-soft)] text-[11px] font-semibold text-[var(--t-accent)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--t-ink)]">{d.title}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--t-muted)] transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-1.5 pl-8 text-[12.5px] leading-relaxed text-[var(--t-muted)]">{d.why}</p>
              </details>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}
