import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { num } from "./snapshot-shared";

// ---------------------------------------------------------------------------
// Presentational blocks for PropertyOnePager (2026-10-20 visual refresh).
// Server-safe (no hooks), print-safe (no JS needed to be legible), and every
// value is passed in: nothing here computes or invents a number. Shape stays
// on the DESIGN.md tokens: 2px cards, flat hairline borders, brand blue.
// ---------------------------------------------------------------------------

const CARD = "rounded-[2px] border border-border bg-card";

export function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

// Tiny inline column chart for a KPI tile. Only rendered when a REAL series
// exists for that KPI; tiles without one stay clean rather than faking a
// shape.
function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mt-3 flex h-6 items-end gap-[2px]" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`ls-view-grow-y min-h-[2px] flex-1 ${i === values.length - 1 ? "bg-primary" : "bg-primary/30"}`}
          style={{ height: `${Math.max(6, Math.round((v / max) * 100))}%`, "--reveal-step": i * 0.2 } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function KpiTile({
  icon,
  value,
  label,
  series,
  note,
  delta,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  series?: number[];
  note?: string;
  delta?: { up: boolean; text: string };
}) {
  return (
    <div className={`${CARD} flex min-w-0 flex-col px-3.5 py-3`}>
      <IconChip icon={icon} />
      <div className="ls-metric mt-2.5 text-[24px] leading-none sm:text-[26px]">{value}</div>
      <div className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground">{label}</div>
      {delta ? (
        <div className={`mt-1 text-[10px] font-semibold ${delta.up ? "text-success" : "text-destructive"}`}>
          {delta.up ? "▲" : "▼"} {delta.text}
        </div>
      ) : note ? (
        <div className="mt-1 text-[10px] font-medium leading-tight text-muted-foreground">{note}</div>
      ) : null}
      {series && series.length > 1 ? <div className="mt-auto"><MiniBars values={series} /></div> : null}
    </div>
  );
}

export function TakeawayCard({
  index,
  lead,
  figure,
  tail,
}: {
  index: number;
  lead: string;
  figure: string;
  tail?: string;
}) {
  return (
    <div className={`${CARD} flex gap-3 px-4 py-3.5`}>
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/[0.1] text-[13px] font-bold text-primary">
        {index}
      </span>
      <p className="text-[12.5px] leading-snug text-foreground">
        {lead}{" "}
        <span className="block text-[19px] font-semibold leading-tight tracking-[-0.01em] text-primary">{figure}</span>
        {tail ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{tail}</span> : null}
      </p>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD} min-w-0 break-inside-avoid p-4 sm:p-5 print:p-3.5 ${className}`}>
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p> : null}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

// Horizontal bar list. `muted` rows render a grey bar and a text value
// (e.g. "not tracked") so they read as context, not as a zero.
export function BarList({
  rows,
  labelWidth = "w-[150px]",
}: {
  rows: Array<{ label: string; value: number; display?: string; muted?: boolean; icon?: LucideIcon }>;
  labelWidth?: string;
}) {
  const max = Math.max(1, ...rows.filter((r) => !r.muted).map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => {
        const Icon = r.icon;
        return (
          <div key={r.label} className="flex items-center gap-2.5 text-[12px]">
            {Icon ? <Icon className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" /> : null}
            <span className={`${labelWidth} flex-none truncate font-medium ${r.muted ? "text-muted-foreground" : "text-foreground"}`}>
              {r.label}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              {!r.muted ? (
                <span
                  className="ls-view-grow-x block h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(2, Math.round((r.value / max) * 100))}%`, "--reveal-step": i } as React.CSSProperties}
                />
              ) : null}
            </span>
            <span className={`w-16 flex-none text-right tabular-nums ${r.muted ? "text-[11px] text-muted-foreground" : "font-semibold"}`}>
              {r.display ?? num(r.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Arrow-step funnel. Callers must pass monotonic, same-population stages:
// a chevron row implies each step is a subset of the one before it.
export function ChevronFunnel({ stages }: { stages: Array<{ value: string; label: string }> }) {
  // Only the last step is solid brand blue with white text; lighter steps
  // keep ink text so every label clears contrast.
  const shade = (i: number) =>
    i === stages.length - 1 ? "bg-primary text-white" : i === 0 ? "bg-primary/[0.1] text-foreground" : "bg-primary/[0.24] text-foreground";
  return (
    <div className="flex">
      {stages.map((s, i) => {
        const first = i === 0;
        const last = i === stages.length - 1;
        const clip = first
          ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
          : last
            ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
            : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)";
        return (
          <div
            key={s.label}
            className={`min-w-0 flex-1 py-3 ${first ? "pl-3.5 pr-4" : "px-5"} ${shade(i)} ${first ? "" : "-ml-1"} print:[print-color-adjust:exact]`}
            style={{ clipPath: clip }}
          >
            <div className="ls-metric text-[20px] leading-none text-inherit">{s.value}</div>
            <div className="mt-1 text-[10.5px] font-medium leading-tight opacity-80">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function IconStat({
  icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <IconChip icon={icon} />
      <div className="min-w-0">
        <div className="ls-metric text-[18px] leading-none text-primary">{value}</div>
        <div className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Labelled monthly columns ("2026-07" -> "Jul"), value printed on top of
// every non-zero bar so the chart reads in print without a y-axis.
export function MonthBars({ months }: { months: Array<{ month: string; count: number }> }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {months.map((m, i) => (
          <div key={m.month} className="flex h-full flex-1 flex-col justify-end">
            <span className="mb-0.5 text-center text-[9px] font-semibold tabular-nums text-muted-foreground">
              {m.count > 0 ? m.count : ""}
            </span>
            <span
              className={`ls-view-grow-y block min-h-[2px] rounded-t-[2px] ${m.count === max ? "bg-primary" : "bg-primary/30"}`}
              style={{ height: `${Math.round((m.count / max) * 80)}%`, "--reveal-step": i * 0.4 } as React.CSSProperties}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {months.map((m) => (
          <span key={m.month} className="flex-1 text-center text-[9px] font-medium text-muted-foreground">
            {MONTHS[Number(m.month.slice(5, 7)) - 1] ?? m.month}
          </span>
        ))}
      </div>
    </div>
  );
}
