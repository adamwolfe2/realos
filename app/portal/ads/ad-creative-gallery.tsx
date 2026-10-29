"use client";

import * as React from "react";
import { AdPlatform } from "@prisma/client";
import { ImageOff, ExternalLink } from "lucide-react";
import { Logo, Pill } from "@/components/portal/overview/kit";
import { cn } from "@/lib/utils";

// Creative gallery for /portal/ads: one card per ad the customer runs,
// ranked by results over the 28-day window. Read-only; the only link out
// is the ad's own landing page.

export type CreativeItem = {
  id: string;
  platform: AdPlatform;
  name: string;
  status: string | null;
  format: string | null;
  thumbnailUrl: string | null;
  headline: string | null;
  body: string | null;
  landingUrl: string | null;
  campaignName: string | null;
  impressions: number;
  clicks: number;
  spendCents: number;
  leads: number;
};

type SortKey = "cpl" | "spend" | "leads" | "ctr";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "cpl", label: "Cost per lead" },
  { key: "spend", label: "Spend" },
  { key: "leads", label: "Leads" },
  { key: "ctr", label: "Click rate" },
];

export function ctr(i: CreativeItem): number {
  return i.impressions > 0 ? i.clicks / i.impressions : 0;
}
export function costPerLeadCents(i: CreativeItem): number | null {
  return i.leads > 0 ? Math.round(i.spendCents / i.leads) : null;
}

/** Ads with no leads sort last on cost per lead; among them, spend desc. */
export function sortCreatives(items: CreativeItem[], key: SortKey): CreativeItem[] {
  const out = [...items];
  out.sort((a, b) => {
    if (key === "cpl") {
      const ca = costPerLeadCents(a);
      const cb = costPerLeadCents(b);
      if (ca !== null && cb !== null) return ca - cb;
      if (ca !== null) return -1;
      if (cb !== null) return 1;
      return b.spendCents - a.spendCents;
    }
    if (key === "spend") return b.spendCents - a.spendCents;
    if (key === "leads") return b.leads - a.leads || b.spendCents - a.spendCents;
    return ctr(b) - ctr(a);
  });
  return out;
}

/** Best = lowest cost per lead; worst = highest spend with zero leads, else highest cost per lead. */
export function pickCallouts(items: CreativeItem[]): { bestId: string | null; worstId: string | null } {
  const withLeads = items.filter((i) => i.leads > 0 && i.spendCents > 0);
  const best = withLeads.length ? sortCreatives(withLeads, "cpl")[0] : null;
  const noLeads = items.filter((i) => i.leads === 0 && i.spendCents > 0).sort((a, b) => b.spendCents - a.spendCents);
  const worst = noLeads[0] ?? (withLeads.length > 1 ? sortCreatives(withLeads, "cpl").at(-1) ?? null : null);
  return { bestId: best?.id ?? null, worstId: worst && worst.id !== best?.id ? worst.id : null };
}

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: cents >= 10000 ? 0 : 2 })}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function AdCreativeGallery({ items }: { items: CreativeItem[] }) {
  const [sort, setSort] = React.useState<SortKey>("cpl");
  const sorted = React.useMemo(() => sortCreatives(items, sort), [items, sort]);
  const { bestId, worstId } = React.useMemo(() => pickCallouts(items), [items]);

  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--t-muted)]">
        No ads pulled in yet. Creatives appear after the next daily refresh of a connected account.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-[var(--t-muted)]">
          {items.length} {items.length === 1 ? "ad" : "ads"} · ranked by {SORTS.find((s) => s.key === sort)?.label.toLowerCase()}
        </p>
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--t-muted)]">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-[2px] border border-[var(--t-border)] bg-white px-2 text-[12.5px] text-[var(--t-text)]"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((item) => (
          <CreativeCard key={item.id} item={item} callout={item.id === bestId ? "best" : item.id === worstId ? "worst" : null} />
        ))}
      </ul>
    </div>
  );
}

function CreativeCard({ item, callout }: { item: CreativeItem; callout: "best" | "worst" | null }) {
  const cpl = costPerLeadCents(item);
  const paused = item.status ? /PAUSED|DISABLED|ARCHIVED|DELETED|REMOVED/i.test(item.status) : false;
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[var(--t-radius)] border bg-white",
        callout === "best" ? "border-[#15803d]" : callout === "worst" ? "border-[#b91c1c]" : "border-[var(--t-border)]",
      )}
    >
      <Thumb item={item} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--t-ink)]" title={item.headline ?? item.name}>
              {item.headline ?? item.name}
            </p>
            <p className="truncate text-[12px] text-[var(--t-muted)]" title={item.campaignName ?? item.name}>
              {item.campaignName ?? item.name}
            </p>
          </div>
          <Logo slug={item.platform === AdPlatform.GOOGLE_ADS ? "google-ads" : "meta-ads"} size={16} />
        </div>
        {item.body ? <p className="line-clamp-2 text-[12px] text-[var(--t-text)]">{item.body}</p> : null}
        <dl className="mt-auto grid grid-cols-4 gap-2 border-t border-[var(--t-divider)] pt-2 text-[12px] tabular-nums">
          <Cell label="Spend" value={money(item.spendCents)} />
          <Cell label="Leads" value={String(item.leads)} />
          <Cell label="Per lead" value={cpl === null ? "—" : money(cpl)} />
          <Cell label="CTR" value={pct(ctr(item))} />
        </dl>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {callout === "best" ? <Pill tone="good">Best cost per lead</Pill> : null}
            {callout === "worst" ? <Pill tone="bad">{item.leads === 0 ? "Spend, no leads" : "Highest cost per lead"}</Pill> : null}
            {paused ? <Pill tone="neutral">Paused</Pill> : null}
          </div>
          {item.landingUrl ? (
            <a
              href={item.landingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-[var(--t-muted)] hover:text-[var(--t-ink)]"
              aria-label="Open landing page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Thumb({ item }: { item: CreativeItem }) {
  // Meta thumbnails are signed CDN URLs that expire between syncs; fall back
  // to a text tile on load error instead of a broken image.
  const [broken, setBroken] = React.useState(false);
  if (item.thumbnailUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.thumbnailUrl}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="aspect-square w-full bg-neutral-100 object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-[2/1] w-full flex-col items-center justify-center gap-1 bg-neutral-50 px-4 text-center">
      {item.thumbnailUrl ? <ImageOff className="h-4 w-4 text-[var(--t-muted)]" /> : null}
      <span className="text-[11px] uppercase tracking-wide text-[var(--t-muted)]">
        {item.format === "video" ? "Video" : item.format === "carousel" ? "Carousel" : "Text ad"}
      </span>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--t-muted)]">{label}</dt>
      <dd className="truncate font-medium text-[var(--t-ink)]">{value}</dd>
    </div>
  );
}
