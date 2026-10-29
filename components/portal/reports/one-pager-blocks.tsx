import type * as React from "react";
import { num } from "./snapshot-shared";

// ---------------------------------------------------------------------------
// Presentational blocks for PropertyOnePager (2026-10-20 refresh).
// Server-safe (no hooks), print-safe (legible without JS), and every value is
// passed in: nothing here computes or invents a number. DESIGN.md shape:
// 2px cards, flat hairlines, mono figures, brand blue only on data. Icons are
// used where they identify something (engines, review sources), never as
// decoration on a stat.
// ---------------------------------------------------------------------------

export type Figure = {
  value: string;
  label: string;
  note?: string;
  delta?: { up: boolean; text: string };
};

// Headline figures as one hairline-divided band. Desktop/print: a single row.
// Phone: one row per figure, number left and label beside it, so an odd count
// never strands a lone cell across the full width.
export function FigureBand({ figures }: { figures: Figure[] }) {
  return (
    <div className="flex divide-border overflow-hidden rounded-[2px] border border-border bg-card max-sm:flex-col max-sm:divide-y sm:divide-x print:flex-row print:divide-x print:divide-y-0">
      {figures.map((f) => (
        <div
          key={f.label}
          className="min-w-0 flex-1 px-4 py-3.5 max-sm:flex max-sm:items-baseline max-sm:gap-4 max-sm:py-2.5"
        >
          <div className="ls-metric text-[26px] leading-none max-sm:w-[76px] max-sm:flex-none">
            {f.value}
          </div>
          <div className="min-w-0">
            <div className="mt-1.5 text-[11px] font-medium leading-tight text-muted-foreground max-sm:mt-0">
              {f.label}
            </div>
            {f.delta ? (
              <div
                className={`mt-1 text-[10px] font-semibold ${f.delta.up ? "text-success" : "text-destructive"}`}
              >
                {f.delta.up ? "▲" : "▼"} {f.delta.text}
              </div>
            ) : null}
            {f.note ? (
              <div className="mt-1 text-[10px] font-medium leading-tight text-muted-foreground">
                {f.note}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// Secondary figures inside a panel: mono value over label, hairline between.
// `stacked` lists them vertically (a figure column beside a chart).
export function FigureRow({
  figures,
  stacked = false,
}: {
  figures: Figure[];
  stacked?: boolean;
}) {
  return (
    <div
      className={
        stacked
          ? "flex flex-col divide-y divide-border"
          : "flex divide-x divide-border"
      }
    >
      {figures.map((f) => (
        <div
          key={f.label}
          className={
            stacked
              ? "py-3 first:pt-0 last:pb-0"
              : "min-w-0 flex-1 px-3 first:pl-0 last:pr-0"
          }
        >
          <div className="ls-metric text-[18px] leading-none">{f.value}</div>
          <div className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
            {f.label}
          </div>
        </div>
      ))}
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
  subtitle?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 break-inside-avoid rounded-[2px] border border-border bg-card p-5 print:p-3.5 ${className}`}
    >
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Horizontal bar list. `muted` rows render an empty track and a text value
// (e.g. "not tracked") so they read as context, not as a zero.
export function BarList({
  rows,
  labelWidth = "w-[150px]",
}: {
  rows: Array<{
    label: string;
    value: number;
    display?: string;
    muted?: boolean;
  }>;
  labelWidth?: string;
}) {
  const max = Math.max(1, ...rows.filter((r) => !r.muted).map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-3 text-[12px]">
          <span
            title={r.label}
            className={`${labelWidth} flex-none truncate font-medium ${r.muted ? "text-muted-foreground" : "text-foreground"}`}
          >
            {r.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-[1px] bg-muted">
            {!r.muted ? (
              <span
                className="ls-view-grow-x block h-full rounded-[1px] bg-primary"
                style={
                  {
                    width: `${Math.max(2, Math.round((r.value / max) * 100))}%`,
                    "--reveal-step": i,
                  } as React.CSSProperties
                }
              />
            ) : null}
          </span>
          <span
            className={`w-16 flex-none text-right tabular-nums ${r.muted ? "text-[11px] text-muted-foreground" : "font-semibold"}`}
          >
            {r.display ?? num(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Arrow-step funnel. Callers must pass monotonic, same-population stages:
// a chevron row implies each step is a subset of the one before it. Only the
// last step is solid brand blue with white text; lighter steps keep ink text
// so every label clears contrast.
export function ChevronFunnel({
  stages,
}: {
  stages: Array<{ value: string; label: string }>;
}) {
  const shade = (i: number) =>
    i === stages.length - 1
      ? "bg-primary text-white"
      : i === 0
        ? "bg-primary/[0.08] text-foreground"
        : "bg-primary/[0.2] text-foreground";
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
            className={`min-w-0 flex-1 py-3 ${first ? "pl-3.5 pr-4" : "-ml-1 px-5"} ${shade(i)} print:[print-color-adjust:exact]`}
            style={{ clipPath: clip }}
          >
            <div className="ls-metric text-[20px] leading-none text-inherit!">
              {s.value}
            </div>
            <div className="mt-1 text-[10.5px] font-medium leading-tight opacity-80">
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Labelled monthly columns ("2026-07" -> "Jul"), value printed on top of
// every non-zero bar so the chart reads in print without a y-axis.
export function MonthBars({
  months,
}: {
  months: Array<{ month: string; count: number }>;
}) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {months.map((m, i) => (
          <div
            key={m.month}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <span className="mb-0.5 text-center text-[10px] font-semibold tabular-nums text-muted-foreground">
              {m.count > 0 ? m.count : ""}
            </span>
            <span
              className={`ls-view-grow-y block min-h-[2px] rounded-t-[1px] ${m.count === max ? "bg-primary" : "bg-primary/30"}`}
              style={
                {
                  height: `${Math.round((m.count / max) * 80)}%`,
                  "--reveal-step": i * 0.4,
                } as React.CSSProperties
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-border pt-1.5">
        {months.map((m) => (
          <span
            key={m.month}
            className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
          >
            {MONTHS[Number(m.month.slice(5, 7)) - 1] ?? m.month}
          </span>
        ))}
      </div>
    </div>
  );
}
