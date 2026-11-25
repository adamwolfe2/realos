import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { change, Metric, Panel } from "@/components/portal/overview/kit";
import { Cell, Gap, trendCell } from "@/components/portal/overview/portfolio";
import { LISTED_TRACKING_SINCE, sum } from "@/lib/portal/portfolio-overview";
import type { CockpitListing, Health, PropertyCockpit } from "@/lib/portal/property-cockpit";

// Property drill-down: the funnel as small multiples, every advertised unit,
// what search and the site do, what renters ask, and how fresh each source
// is. Every number names its source; a missing source says so.

const fmt = new Intl.NumberFormat("en-US");
const usd = (c: number) => `$${fmt.format(Math.round(c / 100))}`;
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DAY = 86_400_000;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export function PropertyCockpitView({ data, now, toursOnPlan }: { data: PropertyCockpit; now: number; toursOnPlan: boolean }) {
  return (
    <div className="space-y-4">
      <HealthStrip health={data.health} now={now} />
      <Funnel data={data} toursOnPlan={toursOnPlan} />
      <ListingsTable listings={data.listings} now={now} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <SearchPanel data={data} />
          <ChatPanel data={data} />
        </div>
        <div className="min-w-0 space-y-4">
          <PagesPanel data={data} />
          <PopupPanel data={data} />
        </div>
      </div>
    </div>
  );
}

const DOT: Record<Health["state"], string> = { fresh: "#16a34a", stale: "#d97706", error: "#dc2626", off: "#c3cbdb" };

function ago(d: Date, now: number) {
  const h = Math.round((now - d.getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function HealthStrip({ health, now }: { health: Health[]; now: number }) {
  return (
    <ul id="data-health" className="scroll-mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] px-4 py-2.5 text-[12.5px] shadow-[var(--t-shadow)]" aria-label="Data sources">
      {health.map((h) => (
        <li key={h.label} className="inline-flex items-center gap-1.5" title={h.note ?? undefined}>
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DOT[h.state] }} />
          <span className="text-[var(--t-ink)]">{h.label}</span>
          <span className="text-[var(--t-muted)]">
            {h.state === "off" ? "Not connected" : h.state === "error" ? "Last sync failed" : h.at ? `${ago(h.at, now)}${h.state === "stale" ? " (stale)" : ""}` : "No activity yet"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Funnel({ data, toursOnPlan }: { data: PropertyCockpit; toursOnPlan: boolean }) {
  const f = data.funnel;
  const v = f.visitors ? sum(f.visitors.cur) : null;
  const c = sum(f.chats.cur);
  return (
    <dl id="funnel" className="scroll-mt-6 grid grid-cols-2 overflow-hidden rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] shadow-[var(--t-shadow)] lg:grid-cols-5 [&>*]:-ml-px [&>*]:-mt-px [&>*]:border-l [&>*]:border-t [&>*]:border-[var(--t-divider)]">
      {f.visitors
        ? trendCell("Organic visitors", f.visitors, data.today, "GA4 + Search Console", "Search visits per day (larger of GA4 organic sessions and Search Console clicks), last 28 days vs the 28 before.", 1)
        : <Cell label="Organic visitors" value="—" source="GA4 + Search Console" title="No GA4 or Search Console connected for this site."><Gap>Not connected</Gap></Cell>}
      {trendCell("Chats", f.chats, data.today, v ? `${pct(c, v)} of visitors · chatbot` : "LeaseStack chatbot", "Chatbot conversations started, last 28 days vs the 28 before.")}
      {trendCell("Website leads", f.leads, data.today, `Chat ${f.leadMix.chat} · Pop-up ${f.leadMix.popup} · Other ${f.leadMix.other}`, "Leads captured on the site, last 28 days vs the 28 before. AppFolio applicants count under Applications.")}
      {f.apps
        ? trendCell(
            "Applications",
            // A hollow prior window is not drawn: no dashed line to compare.
            f.appsComparable ? f.apps : { cur: f.apps.cur, prev: [] },
            data.today,
            f.appsComparable ? "AppFolio · by received date" : "AppFolio · no change: activated recently",
            "Primary applicants by the date AppFolio received them. Applicants can apply without becoming a website lead first, so this can exceed leads. No change is shown when the building was activated in LeaseStack too recently for a full prior 28 days.",
            0,
            f.appsComparable ? undefined : { cur: 0, prev: 0 },
          )
        : <Cell label="Applications" value="—" source="AppFolio" title="AppFolio is not connected."><Gap>Not connected</Gap></Cell>}
      <div className="col-span-2 lg:col-span-1">
        {toursOnPlan
          ? <Cell label="Tours" value="—" source="AppFolio showings" title="Tours are not tracked per property yet."><Gap>Not tracked yet</Gap></Cell>
          : <Cell label="Tours" value="—" source="AppFolio showings report" title="AppFolio returns 404 for the showings report on this account's plan."><Gap>Not on this AppFolio plan</Gap></Cell>}
      </div>
    </dl>
  );
}

const KIND: Record<CockpitListing["kind"], string> = { room: "Room", unit: "Apartment", other: "Other" };

function daysListed(l: CockpitListing, now: number) {
  if (l.listedAt) return `${Math.max(0, Math.floor((now - l.listedAt.getTime()) / DAY))}d`;
  const floor = Math.floor((now - LISTED_TRACKING_SINCE.getTime()) / DAY);
  return floor >= 1 ? `≥${floor}d` : "Tracking";
}

function ListingsTable({ listings, now }: { listings: CockpitListing[]; now: number }) {
  const sinceDay = day.format(LISTED_TRACKING_SINCE);
  return (
    <Panel id="units" title="Advertised units" aside={<span title={`Days listed tracked since ${sinceDay}`}>{listings.length} on AppFolio</span>} flush>
      {listings.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] sm:min-w-[620px]">
            <thead>
              <tr className="border-b border-[var(--t-divider)] text-[12px] text-[var(--t-muted)]">
                <th scope="col" className="sticky left-0 z-10 h-9 bg-[var(--t-card)] pl-4 pr-2 text-left font-medium">Unit</th>
                <th scope="col" className="hidden px-2 text-left font-medium sm:table-cell">Kind</th>
                <th scope="col" className="hidden px-2 text-right font-medium sm:table-cell">Beds</th>
                <th scope="col" className="px-2 text-right font-medium">Rent</th>
                <th scope="col" className="px-2 text-right font-medium" title={`Days since LeaseStack first saw it advertised. Listings advertised before ${sinceDay} show at least that many days.`}>Listed</th>
                <th scope="col" className="px-2 text-right font-medium" title="AppFolio ready-for-showing date">Move-in</th>
                <th scope="col" className="hidden pl-2 pr-4 text-right font-medium sm:table-cell" title="Where AppFolio posts it">Posted</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-[var(--t-divider)] last:border-0">
                  <td className="sticky left-0 z-10 max-w-[150px] bg-[var(--t-card)] py-2 pl-4 pr-2 text-[var(--t-ink)] sm:max-w-[220px]" title={l.unit}>
                    <span className="block truncate">{l.unit}</span>
                    <span className="block text-[11.5px] text-[var(--t-muted)] sm:hidden">{KIND[l.kind]}{l.nextTerm ? " · pre-lease" : ""}</span>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 text-[var(--t-text)] sm:table-cell">
                    {KIND[l.kind]}
                    {l.nextTerm ? <span className="ml-1.5 text-[11.5px] text-[var(--t-muted)]">pre-lease</span> : null}
                  </td>
                  <td className="hidden px-2 text-right tabular-nums text-[var(--t-text)] sm:table-cell">{l.beds === null ? "—" : l.beds === 0 ? "Studio" : fmt.format(l.beds)}</td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums text-[var(--t-ink)]">{l.priceCents === null ? <span className="text-[var(--t-muted)]">No price</span> : usd(l.priceCents)}</td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums text-[var(--t-text)]">{daysListed(l, now)}</td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums text-[var(--t-text)]">
                    {l.availableFrom ? (l.availableFrom.getTime() <= now ? "Now" : day.format(l.availableFrom)) : "—"}
                  </td>
                  <td className="hidden whitespace-nowrap pl-2 pr-4 text-right text-[12px] text-[var(--t-muted)] sm:table-cell">
                    {[l.posted.website && "Site", l.posted.internet && "Syndicated"].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">Nothing advertised on AppFolio right now.</p>
      )}
    </Panel>
  );
}

function SearchPanel({ data }: { data: PropertyCockpit }) {
  const q = data.queries;
  return (
    <Panel id="search" title="Search queries" aside={<span>Search Console · 28 days</span>} flush>
      {q === null ? (
        <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">Search Console isn&apos;t connected for this site. <Link href="/portal/setup" className="text-[var(--t-accent)] hover:underline">Connect it</Link></p>
      ) : q.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">No search impressions in the last 28 days.</p>
      ) : (
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--t-divider)] text-[12px] text-[var(--t-muted)]">
              <th scope="col" className="h-9 pl-4 pr-2 text-left font-medium">Query</th>
              <th scope="col" className="w-16 px-2 text-right font-medium">Clicks</th>
              <th scope="col" className="w-16 px-2 text-right font-medium">Views</th>
              <th scope="col" className="w-24 pl-2 pr-4 text-right font-medium" title="Average Google position (lower is better), change vs the 28 days before">Position</th>
            </tr>
          </thead>
          <tbody>
            {q.map((r) => {
              const moved = r.position !== null && r.prevPosition !== null ? Math.round((r.prevPosition - r.position) * 10) / 10 : null;
              return (
                <tr key={r.query} className="border-b border-[var(--t-divider)] last:border-0">
                  <td className="truncate py-2 pl-4 pr-2 text-[var(--t-ink)]" title={r.query}>{r.query}</td>
                  <td className="px-2 text-right tabular-nums text-[var(--t-ink)]">{fmt.format(r.clicks)}</td>
                  <td className="px-2 text-right tabular-nums text-[var(--t-text)]">{fmt.format(r.impressions)}</td>
                  <td className="whitespace-nowrap pl-2 pr-4 text-right tabular-nums text-[var(--t-ink)]">
                    {r.position ?? "—"}
                    {moved ? (
                      <span className={cn("ml-1.5 inline-flex items-center text-[11.5px]", moved > 0 ? "text-[#15803d]" : "text-[#b91c1c]")} title={`Was ${r.prevPosition}`}>
                        {moved > 0 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
                        {Math.abs(moved)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function PagesPanel({ data }: { data: PropertyCockpit }) {
  const p = data.pages;
  const max = Math.max(1, ...(p ?? []).map((r) => r.sessions));
  return (
    <Panel id="pages" title="Landing pages" aside={<span>GA4 sessions · leads on page</span>} flush>
      {p === null ? (
        <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">GA4 isn&apos;t connected for this site. <Link href="/portal/setup" className="text-[var(--t-accent)] hover:underline">Connect it</Link></p>
      ) : p.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">No GA4 sessions in the last 28 days.</p>
      ) : (
        <ul className="divide-y divide-[var(--t-divider)]">
          {p.map((r) => (
            <li key={r.path} className="px-4 py-2.5" title={`${r.sessions} sessions, ${r.leads} leads (chats that captured contact info + pop-up sign-ups) on this page`}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-[var(--t-ink)]">{r.path}</span>
                <span className="shrink-0 tabular-nums text-[var(--t-muted)]">
                  <span className="text-[var(--t-ink)]">{fmt.format(r.sessions)}</span> · {r.leads} lead{r.leads === 1 ? "" : "s"} · {pct(r.leads, r.sessions)}
                </span>
              </div>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--t-wash)]">
                <span className="block h-full rounded-full bg-[var(--t-accent)]" style={{ width: `${Math.max(4, (r.sessions / max) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ChatPanel({ data }: { data: PropertyCockpit }) {
  const c = data.chat;
  return (
    <Panel id="questions" title="What renters ask" aside={<span>{c.conversations} chats · 28 days</span>} flush>
      {c.conversations === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">No chats in the last 28 days.</p>
      ) : (
        <div className="divide-y divide-[var(--t-divider)]">
          <QuestionList title="Most asked" rows={c.top} empty="No repeated opening questions yet." />
          <QuestionList title="The bot couldn't answer" rows={c.unanswered} empty="Every question got an answer." tone="bad" />
          {c.suggestions.length ? (
            <div className="px-4 py-3">
              <p className="text-[12px] font-medium text-[var(--t-muted)]">Suggested fix, waiting for approval</p>
              {c.suggestions.map((s) => (
                <p key={s.id} className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[var(--t-ink)]">{s.text}</p>
              ))}
              <Link href="/portal/conversations/insights" className="mt-2 inline-block text-[12.5px] text-[var(--t-accent)] hover:underline">Review</Link>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function QuestionList({ title, rows, empty, tone }: { title: string; rows: { question: string; count: number }[]; empty: string; tone?: "bad" }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] font-medium text-[var(--t-muted)]">{title}</p>
      {rows.length ? (
        <ul className="mt-1.5 space-y-1">
          {rows.map((r) => (
            <li key={r.question} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-[var(--t-ink)]" title={r.question}>{r.question}</span>
              <span className={cn("shrink-0 tabular-nums", tone === "bad" ? "text-[#b91c1c]" : "text-[var(--t-muted)]")}>{r.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--t-muted)]">{empty}</p>
      )}
    </div>
  );
}

function PopupPanel({ data }: { data: PropertyCockpit }) {
  const p = data.popup;
  return (
    <Panel title="Pop-up" aside={<span>{p ? (p.live ? "Live" : "Paused") : "Not set up"} · 28 days</span>} flush>
      {p ? (
        <dl className="grid grid-cols-2 [&>*]:border-[var(--t-divider)] [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b">
          <Metric label="Shown" value={fmt.format(p.shown)} delta={change(p.shown, p.prevShown)} />
          <Metric label="Sign-ups" value={fmt.format(p.converted)} delta={change(p.converted, p.prevConverted)} />
          <Metric label="Sign-up rate" value={pct(p.converted, p.shown)} note={p.prevShown ? `was ${pct(p.prevConverted, p.prevShown)}` : undefined} />
          <Metric label="Button clicks" value={fmt.format(p.clicked)} />
        </dl>
      ) : (
        <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">No pop-up on this site. <Link href="/portal/popups" className="text-[var(--t-accent)] hover:underline">Set one up</Link></p>
      )}
    </Panel>
  );
}
