import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { change } from "@/components/portal/overview/kit";
import { sum, WINDOW, type PortfolioOverview, type Series } from "@/lib/portal/portfolio-overview";

// Portfolio small multiples: Stripe-style cells, one line per metric with
// the prior 28 days as a grey reference line. Each cell names its source and
// freshness; a metric without a source says so instead of drawing zeros.

const fmt = new Intl.NumberFormat("en-US");
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DAY = 86_400_000;

export function since(d: Date | null, now: number): string {
  if (!d) return "never";
  const m = Math.max(1, Math.round((now - d.getTime()) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

/** Line for the current window over a grey line for the one before. */
export function TrendLine({ s, height = 56, className }: { s: Series; height?: number; className?: string }) {
  const W = 280;
  const max = Math.max(1, ...s.cur, ...s.prev);
  const pts = (a: number[]) => a.map((v, i) => `${((i / (a.length - 1)) * W).toFixed(1)},${(height - 2 - (v / max) * (height - 6)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={cn("block w-full", className)} style={{ height }} aria-hidden>
      <line x1="0" x2={W} y1={height - 1} y2={height - 1} stroke="var(--t-divider)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polyline points={pts(s.prev)} fill="none" stroke="#c3cbdb" strokeWidth="1.25" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <polyline points={`0,${height} ${pts(s.cur)} ${W},${height}`} fill="var(--t-accent)" opacity="0.07" stroke="none" />
      <polyline points={pts(s.cur)} fill="none" stroke="var(--t-accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Cell({ label, value, delta, source, children, title }: {
  label: string;
  value: ReactNode;
  delta?: { text: string; tone: string } | null;
  source: ReactNode;
  children?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-w-0 flex-col px-4 py-3.5" title={title}>
      <dt className="flex items-baseline justify-between gap-2 text-[12.5px] text-[var(--t-muted)]">
        <span className="truncate">{label}</span>
        {delta ? <span className={cn("shrink-0 text-[12px] font-medium tabular-nums", delta.tone === "good" ? "text-[#15803d]" : delta.tone === "bad" ? "text-[#b91c1c]" : "text-[var(--t-muted)]")}>{delta.text}</span> : null}
      </dt>
      <dd className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-[var(--t-ink)]">{value}</dd>
      <div className="mt-2 min-h-[56px] flex-1">{children}</div>
      <p className="mt-2 text-[11.5px] leading-snug text-[var(--t-muted)]">{source}</p>
    </div>
  );
}

function Range({ today, lag = 0 }: { today: Date; lag?: number }) {
  const end = today.getTime() - lag * DAY;
  return (
    <div className="mt-1 flex justify-between text-[11px] tabular-nums text-[var(--t-muted)]">
      <span>{day.format(new Date(end - (WINDOW - 1) * DAY))}</span>
      <span>{lag ? day.format(new Date(end)) : "Today"}</span>
    </div>
  );
}

export function Gap({ children }: { children: ReactNode }) {
  return <p className="flex h-[56px] items-center text-[12.5px] text-[var(--t-muted)]">{children}</p>;
}

export function trendCell(label: string, s: Series, today: Date, source: ReactNode, title: string, lag = 0, base?: { cur: number; prev: number }) {
  const cur = sum(s.cur);
  const b = base ?? { cur, prev: sum(s.prev) };
  return (
    <Cell label={label} value={fmt.format(cur)} delta={change(b.cur, b.prev) ?? (b.cur && !b.prev ? { text: "new", tone: "neutral" } : null)} source={source} title={title}>
      <TrendLine s={s} />
      <Range today={today} lag={lag} />
    </Cell>
  );
}

export function PortfolioMultiples({ data, now, toursOnPlan }: { data: PortfolioOverview; now: number; toursOnPlan: boolean }) {
  const t = data.totals;
  const n = data.rows.length;
  const mix = t.leadMix;
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] shadow-[var(--t-shadow)] lg:grid-cols-3 [&>*]:-ml-px [&>*]:-mt-px [&>*]:border-l [&>*]:border-t [&>*]:border-[var(--t-divider)]">
      <Cell
        label="Available homes"
        value={fmt.format(t.available)}
        source={`${fmt.format(t.rooms)} rooms · ${fmt.format(t.units)} apts · AppFolio · ${since(data.appfolioSyncedAt, now)}`}
        title="Rooms (a bed or room in a shared unit) and apartments (whole units and studios) advertised on AppFolio right now; parking and storage left out. The line is the daily count since tracking started."
      >
        {data.availability.length >= 2 ? (
          <>
            <TrendLine s={{ cur: data.availability.map((a) => a.homes), prev: [] }} />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-[var(--t-muted)]">
              <span>{day.format(data.availability[0].date)}</span>
              <span>{day.format(data.availability[data.availability.length - 1].date)}{data.availabilitySites < n ? ` · ${data.availabilitySites} of ${n} sites` : ""}</span>
            </div>
          </>
        ) : (
          <>
            <AvailabilityBar rows={data.rows} />
            <p className="mt-1.5 text-[11px] text-[var(--t-muted)]">Daily trend starts {day.format(data.availability[0]?.date ?? data.today)}</p>
          </>
        )}
      </Cell>
      {t.visitorsConnected
        ? trendCell("Organic visitors", t.visitors, data.today, `GA4 + Search Console · ${t.visitorsConnected} of ${data.rows.filter((r) => r.live || r.visitors).length} live sites · synced ${since(data.analyticsSyncedAt, now)}`, `Search visits per day: the larger of GA4 organic sessions and Search Console clicks, last 28 days. The change compares only the ${t.visitorsLike.sites} site${t.visitorsLike.sites === 1 ? "" : "s"} with data in the 28 days before; sites connected since then are new, not growth.`, 1, t.visitorsLike)
        : <Cell label="Organic visitors" value="—" source="GA4 + Search Console" title={data.orgWideAnalytics ? "GA4/Search Console is connected for the whole workspace, not per site, so it can't be split by property. Connect each site's own GA4 and Search Console." : "No property has GA4 or Search Console connected."}><Gap>{data.orgWideAnalytics ? "Workspace-wide only" : "Not connected"}</Gap></Cell>}
      {trendCell("Website leads", t.leads, data.today, `Chat ${mix.chat} · Pop-up ${mix.popup} · Other ${mix.other}`, "Leads captured on the property websites (chatbot, pop-up, forms), last 28 days vs the 28 before. AppFolio applicants are counted under Applications.")}
      {trendCell("Chats", t.chats, data.today, "LeaseStack chatbot · live", "Chatbot conversations started, last 28 days vs the 28 before.")}
      {data.appfolioConnected
        ? trendCell(
            "Applications",
            t.apps,
            data.today,
            `AppFolio · change on ${t.appsLike.sites} of ${n} sites · ${since(data.appfolioSyncedAt, now)}`,
            `Primary applicants by the date AppFolio received the application, last 28 days. AppFolio applications are imported only while a building is active in LeaseStack, so the change compares only the ${t.appsLike.sites} building${t.appsLike.sites === 1 ? "" : "s"} tracked for the whole 56 days; buildings activated since then have no full prior window.`,
            0,
            t.appsLike.sites ? t.appsLike : { cur: 0, prev: 0 },
          )
        : <Cell label="Applications" value="—" source="AppFolio" title="AppFolio is not connected, so applications aren't tracked."><Gap>Not connected</Gap></Cell>}
      {toursOnPlan
        ? trendCell("Tours", t.tours, data.today, "LeaseStack + AppFolio tours", "Tours created, last 28 days vs the 28 before.")
        : (
          <Cell label="Tours" value="—" source="AppFolio showings report" title="AppFolio returns 404 for the showings report on this account's plan, so tours can't be tracked yet.">
            <Gap>Not on this AppFolio plan</Gap>
          </Cell>
        )}
    </dl>
  );
}

/** Where the advertised units are: one segment per building, largest first. */
function AvailabilityBar({ rows }: { rows: PortfolioOverview["rows"] }) {
  const total = rows.reduce((s, r) => s + r.available, 0);
  const parts = rows.filter((r) => r.available > 0).sort((a, b) => b.available - a.available);
  if (!total) return <Gap>Nothing advertised</Gap>;
  const top = parts.slice(0, 3);
  return (
    <div>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Available units by building">
        {parts.map((r, i) => (
          <span key={r.id} title={`${r.name}: ${r.available}`} style={{ width: `${(r.available / total) * 100}%`, background: i < 3 ? "var(--t-accent)" : "#c9d6f5", opacity: i < 3 ? 1 - i * 0.25 : 1 }} />
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-[12px]">
        {top.map((r) => (
          <li key={r.id} className="flex justify-between gap-2"><span className="truncate text-[var(--t-text)]">{r.name}</span><span className="tabular-nums text-[var(--t-ink)]">{r.available}</span></li>
        ))}
      </ul>
    </div>
  );
}
