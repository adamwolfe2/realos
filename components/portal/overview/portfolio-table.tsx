"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PropertyAvatar } from "@/components/portal/properties/property-avatar";
import { LISTED_TRACKING_SINCE, type PortfolioRow, type Series, type SourceHealth } from "@/lib/portal/portfolio-overview";
import type { KindRange } from "@/lib/listings/kind";

// One row per property. Client-side only for sorting; every value arrives
// computed from the server loader. Phones scroll the table sideways with the
// property column pinned.

const fmt = new Intl.NumberFormat("en-US");
const usd = (c: number) => `$${fmt.format(Math.round(c / 100))}`;
const sinceDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(LISTED_TRACKING_SINCE);
const total = (s: Series) => s.cur.reduce((a, n) => a + n, 0);

type Key = "name" | "available" | "rent" | "listed" | "visitors" | "chats" | "leads" | "apps";

const COLS: { key: Key; label: string; title: string; align?: "left" }[] = [
  { key: "name", label: "Property", title: "Sort by name", align: "left" },
  { key: "available", label: "Available", title: "Rooms and whole units advertised on AppFolio now (parking and storage left out)" },
  { key: "rent", label: "Asking rent", title: "Advertised rent on AppFolio, by kind: rooms (a bed or room in a shared unit) and apartments (whole units and studios)" },
  { key: "listed", label: "Days listed", title: `Median days on market: since LeaseStack first saw the listing advertised on AppFolio. Tracking started ${sinceDay}; listings advertised before then count as at least that many days.` },
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
    case "listed": return r.listed.median;
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
      <table className="w-full min-w-[700px] border-collapse text-[13px] sm:min-w-[860px]">
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
                    "h-10 whitespace-nowrap px-2 font-medium text-[var(--t-muted)] sm:px-3",
                    c.align === "left" ? "text-left" : "text-right",
                    i === 0 && "sticky left-0 z-10 bg-[var(--t-card)] pl-3 sm:pl-4",
                  )}
                >
                  <button
                    type="button"
                    title={c.title}
                    onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : c.key !== "name" }))}
                    className={cn("inline-flex items-center gap-1 rounded-sm text-[12px] outline-none hover:text-[var(--t-ink)] focus-visible:ring-2 focus-visible:ring-[var(--t-accent)]/40", on && "text-[var(--t-ink)]")}
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
                <td className="sticky left-0 z-10 bg-[var(--t-card)] py-2 pl-3 pr-2 shadow-[1px_0_0_var(--t-divider)] group-hover:bg-[var(--t-wash)] sm:pl-4 sm:pr-3 sm:shadow-none">
                  <Link href={`/portal/properties/${r.id}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--t-accent)]/40">
                    <PropertyAvatar src={r.image} size="sm" className="rounded-md" />
                    <span className="min-w-0">
                      <span className="block max-w-[96px] truncate font-medium text-[var(--t-ink)] sm:max-w-[180px]">{r.name}</span>
                      {r.city ? <span className="hidden text-[11.5px] text-[var(--t-muted)] sm:block">{r.city}</span> : null}
                    </span>
                  </Link>
                </td>
                <Num title={`${r.available} advertised on AppFolio`}>{r.available}</Num>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-[var(--t-ink)] sm:px-3" title="Advertised rent on AppFolio, by kind">
                  {r.rent.room.count || r.rent.unit.count ? (
                    <span className="inline-grid grid-cols-[auto_auto] items-baseline gap-x-1.5 gap-y-0.5 leading-tight">
                      <RentLine label="Rooms" k={r.rent.room} />
                      <RentLine label="Apts" k={r.rent.unit} />
                    </span>
                  ) : <Dash />}
                </td>
                <Num title={listedTitle(r.listed)}>
                  {r.listed.median === null ? <Dash /> : r.listed.atLeast && r.listed.median < 1 ? <span className="text-[12px] text-[var(--t-muted)]">Tracking</span> : <>{r.listed.atLeast ? <span className="text-[var(--t-muted)]">≥</span> : null}{fmt.format(r.listed.median)}<span className="text-[var(--t-muted)]">d</span></>}
                </Num>
                <td className="px-2 py-2 text-right sm:px-3" title={vis === null ? (r.live ? "GA4 / Search Console not connected for this site" : "The site is still a preview, not live on its own domain: GA4 / Search Console connect at launch") : `${vis} search visits, last 28 days vs ${fmt.format(r.visitors!.prev.reduce((a, n) => a + n, 0))} the 28 before`}>
                  {vis === null ? (
                    <span className="text-[12px] text-[var(--t-muted)]">{r.live ? "Not connected" : "Not live yet"}</span>
                  ) : (
                    <span className="inline-flex items-center justify-end gap-2.5 align-middle">
                      <Spark data={r.visitors!.cur} />
                      <span className="w-9 leading-none tabular-nums text-[var(--t-ink)]">{fmt.format(vis)}</span>
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
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--t-divider)] px-4 py-2.5 text-[11.5px] text-[var(--t-muted)]">
        <span>Data dots: AppFolio, GA4 + Search Console, chatbot</span>
        {(["fresh", "stale", "error", "off", "prelaunch"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DOT[k] }} />
            {{ fresh: "Synced", stale: "Over 36h old", error: "Sync failed", off: "Not connected", prelaunch: "Not live yet" }[k]}
          </span>
        ))}
      </p>
    </div>
  );
}

function RentLine({ label, k }: { label: string; k: KindRange }) {
  if (!k.count) return null;
  const range = k.min === null ? "No price" : k.min === k.max ? usd(k.min) : `${usd(k.min)}–${usd(k.max!).slice(1)}`;
  return (
    <>
      <span className="text-left text-[11px] text-[var(--t-muted)]">{label}</span>
      <span>{range}</span>
    </>
  );
}

function listedTitle(l: PortfolioRow["listed"]): string {
  if (!l.total) return "Nothing advertised";
  const untracked = l.total - l.tracked;
  if (!l.tracked) return `All ${l.total} listings were advertised before tracking started ${sinceDay}`;
  return `${l.tracked} of ${l.total} listings first seen since ${sinceDay}${untracked ? `; ${untracked} advertised before then` : ""}`;
}

function Num({ children, title }: { children: React.ReactNode; title: string }) {
  return <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-[var(--t-ink)] sm:px-3" title={title}>{children}</td>;
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
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="hidden shrink-0 sm:block">
      <polyline points={pts} fill="none" stroke="var(--t-accent)" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

const DOT: Record<SourceHealth["state"], string> = { fresh: "#16a34a", stale: "#d97706", error: "#dc2626", off: "#c3cbdb", prelaunch: "#e3e7ef" };

function ago(d: Date | null, now: number) {
  if (!d) return "";
  const h = Math.round((now - new Date(d).getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function line(name: string, h: SourceHealth, now: number) {
  if (h.state === "off") return `${name}: not connected`;
  if (h.state === "prelaunch") return `${name}: site not live yet`;
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
