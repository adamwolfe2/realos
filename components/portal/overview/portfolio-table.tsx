"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PropertyAvatar } from "@/components/portal/properties/property-avatar";
import type { PortfolioRow, Series, SourceHealth } from "@/lib/portal/portfolio-overview";

// One row per property. Client-side only for sorting; every value arrives
// computed from the server loader. Phones scroll the table sideways with the
// property column pinned.

const fmt = new Intl.NumberFormat("en-US");
const usd = (c: number) => `$${fmt.format(Math.round(c / 100))}`;
const total = (s: Series) => s.cur.reduce((a, n) => a + n, 0);

type Key = "name" | "available" | "rent" | "ready" | "visitors" | "chats" | "leads" | "apps";

const COLS: { key: Key; label: string; title: string; align?: "left" }[] = [
  { key: "name", label: "Property", title: "Sort by name", align: "left" },
  { key: "available", label: "Available", title: "Units and floor plans advertised on AppFolio now" },
  { key: "rent", label: "Asking rent", title: "Lowest to highest advertised rent on available listings (AppFolio)" },
  { key: "ready", label: "Days ready", title: "Median days since AppFolio's ready-for-showing date, for units already past it. Listing age (first listed) isn't tracked yet." },
  { key: "visitors", label: "Organic visitors", title: "Search visits, last 28 days (larger of GA4 organic sessions and Search Console clicks per day)" },
  { key: "chats", label: "Chats", title: "Chatbot conversations, last 28 days" },
  { key: "leads", label: "Leads", title: "Website leads (chat, pop-up, forms), last 28 days" },
  { key: "apps", label: "Apps", title: "AppFolio applications received, last 28 days" },
];

function value(r: PortfolioRow, k: Key): number | string | null {
  switch (k) {
    case "name": return r.name.toLowerCase();
    case "available": return r.available;
    case "rent": return r.rentMin;
    case "ready": return r.readyDaysMedian;
    case "visitors": return r.visitors ? total(r.visitors) : null;
    case "chats": return total(r.chats);
    case "leads": return total(r.leads);
    case "apps": return total(r.apps);
  }
}

export function PortfolioTable({ rows, now }: { rows: PortfolioRow[]; now: number }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "available", desc: true });
  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      // Missing values ("not connected", no listings) always sink.
      if (va === null && vb === null) return a.name.localeCompare(b.name);
      if (va === null) return 1;
      if (vb === null) return -1;
      const c = va < vb ? -1 : va > vb ? 1 : a.name.localeCompare(b.name);
      return sort.desc ? -c : c;
    });
    return out;
  }, [rows, sort]);

  return (
    <div className="overflow-x-auto rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] shadow-[var(--t-shadow)]">
      <table className="w-full min-w-[860px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--t-divider)]">
            {COLS.map((c, i) => {
              const on = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}
                  className={cn(
                    "h-10 whitespace-nowrap px-3 font-medium text-[var(--t-muted)]",
                    c.align === "left" ? "text-left" : "text-right",
                    i === 0 && "sticky left-0 z-10 bg-[var(--t-card)] pl-4",
                  )}
                >
                  <button
                    type="button"
                    title={c.title}
                    onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : c.key !== "name" }))}
                    className={cn("inline-flex items-center gap-1 text-[12px] hover:text-[var(--t-ink)]", on && "text-[var(--t-ink)]")}
                  >
                    {c.label}
                    {on ? (sort.desc ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUp className="h-3 w-3" aria-hidden />) : null}
                  </button>
                </th>
              );
            })}
            <th scope="col" className="h-10 w-12 pr-4 text-right text-[12px] font-medium text-[var(--t-muted)]" title="Last sync per source">Data</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const vis = r.visitors ? total(r.visitors) : null;
            return (
              <tr
                key={r.id}
                onClick={() => router.push(`/portal/properties/${r.id}`)}
                className="group cursor-pointer border-b border-[var(--t-divider)] last:border-0 hover:bg-[var(--t-wash)]"
              >
                <td className="sticky left-0 z-10 bg-[var(--t-card)] py-2 pl-4 pr-3 group-hover:bg-[var(--t-wash)]">
                  <Link href={`/portal/properties/${r.id}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2.5">
                    <PropertyAvatar src={r.image} size="sm" className="rounded-md" />
                    <span className="min-w-0">
                      <span className="block max-w-[180px] truncate font-medium text-[var(--t-ink)]">{r.name}</span>
                      {r.city ? <span className="block text-[11.5px] text-[var(--t-muted)]">{r.city}</span> : null}
                    </span>
                  </Link>
                </td>
                <Num title={`${r.available} advertised on AppFolio`}>{r.available}</Num>
                <Num title={r.rentMin === null ? "No advertised price" : "Advertised rent, AppFolio"}>
                  {r.rentMin === null ? <Dash /> : r.rentMin === r.rentMax ? usd(r.rentMin) : <>{usd(r.rentMin)}<span className="text-[var(--t-muted)]">–</span>{usd(r.rentMax!)}</>}
                </Num>
                <Num title={r.readyDaysMedian === null ? "No unit past its ready date" : `Median of ${r.readyCount} unit${r.readyCount === 1 ? "" : "s"} past AppFolio's ready-for-showing date; oldest ${fmt.format(r.readyDaysOldest!)} days`}>
                  {r.readyDaysMedian === null ? <Dash /> : <>{fmt.format(r.readyDaysMedian)}<span className="text-[var(--t-muted)]">d</span></>}
                </Num>
                <td className="px-3 py-2 text-right" title={vis === null ? "GA4 / Search Console not connected for this site" : `${vis} search visits, last 28 days vs ${fmt.format(r.visitors!.prev.reduce((a, n) => a + n, 0))} the 28 before`}>
                  {vis === null ? (
                    <span className="text-[12px] text-[var(--t-muted)]">Not connected</span>
                  ) : (
                    <span className="inline-flex items-center justify-end gap-2.5">
                      <Spark data={r.visitors!.cur} />
                      <span className="w-9 tabular-nums text-[var(--t-ink)]">{fmt.format(vis)}</span>
                    </span>
                  )}
                </td>
                <Num title="Chatbot conversations, last 28 days">{total(r.chats)}</Num>
                <Num title={`Chat ${r.leadMix.chat} · Pop-up ${r.leadMix.popup} · Other ${r.leadMix.other}, last 28 days`}>{total(r.leads)}</Num>
                <Num title="AppFolio applications received, last 28 days">{total(r.apps)}</Num>
                <td className="py-2 pr-4 text-right">
                  <Health h={r.health} now={now} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Num({ children, title }: { children: React.ReactNode; title: string }) {
  return <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--t-ink)]" title={title}>{children}</td>;
}

function Dash() {
  return <span className="text-[var(--t-muted)]">—</span>;
}

function Spark({ data }: { data: number[] }) {
  const W = 64;
  const H = 18;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - 1 - (v / max) * (H - 3)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke="var(--t-accent)" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

const DOT: Record<SourceHealth["state"], string> = { fresh: "#16a34a", stale: "#d97706", error: "#dc2626", off: "#c3cbdb" };

function ago(d: Date | null, now: number) {
  if (!d) return "";
  const h = Math.round((now - new Date(d).getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function line(name: string, h: SourceHealth, now: number) {
  if (h.state === "off") return `${name}: not connected`;
  if (h.state === "error") return `${name}: last sync failed${h.error ? ` (${h.error.slice(0, 80)})` : ""}`;
  return `${name}: ${h.at ? `synced ${ago(h.at, now)}` : "live"}${h.state === "stale" ? " (stale)" : ""}`;
}

function Health({ h, now }: { h: PortfolioRow["health"]; now: number }) {
  const sources: [string, SourceHealth][] = [["AppFolio", h.appfolio], ["GA4 + Search Console", h.analytics], ["Chatbot", h.chatbot]];
  const label = sources.map(([n, s]) => line(n, s, now)).join("\n");
  return (
    <span className="inline-flex items-center gap-1" title={label} role="img" aria-label={label}>
      {sources.map(([n, s]) => (
        <span key={n} className="h-2 w-2 rounded-full" style={{ background: DOT[s.state] }} />
      ))}
    </span>
  );
}
