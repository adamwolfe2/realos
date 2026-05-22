import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

const FIXES: Array<{ num: number; status: "FIXED" | "IN_PROGRESS"; note: string }> = [
  { num: 69, status: "FIXED", note: "PropertyFormDialog import + render commented out in app/portal/properties/page.tsx with reference to this issue. Add-property dialog hidden until backend write path lands." },
  { num: 70, status: "FIXED", note: "Operations group commented out of CATEGORIES in app/portal/properties/[id]/property-tabs.tsx. Sub-routes (residents/renewals/occupancy/work-orders) still resolve so deep links don't 404; nav drops them." },
  { num: 77, status: "FIXED", note: "Renewal pipeline hidden in app/portal/properties/[id]/tabs/overview.tsx with note 'rent-roll cadence is not the LeaseStack focus'. Bucket math retained so downstream insight detectors still work." },
  { num: 80, status: "FIXED", note: "components/portal/reputation/metrics-panel.tsx: 'Active mentions' tile now headlines the freshness-window count, hint shows '+X in last 30d' delta, secondary line surfaces 'X older hidden' so the operator can reconcile with what Google shows directly. Also adds the freshness-policy note at the top of the panel." },
  { num: 81, status: "FIXED", note: "components/portal/reputation/metrics-panel.tsx hint on the % Negative tile now defines NEGATIVE as 'sentiment classified by the LLM during scan (1-2 star reviews + posts scored as dissatisfaction). Percentage divides NEGATIVE-tagged mentions by total mention count.'" },
  { num: 82, status: "FIXED", note: "metrics-panel.tsx Google rating tile now shows total reviews + in-feed count side-by-side ('57 reviews · 5 in feed (Google caps API)') so the gap is visible. The headline rating is sourced from googleAggRating, which reflects the full historical pool not just the 5 most-recent reviews." },
  { num: 83, status: "FIXED", note: "lib/reputation/freshness.ts GENERAL_THREAD_MAX_AGE_DAYS = 6 months. Reddit + Tavily + Other sources are filtered to the last 6 months by default. Operators can opt-in via ?showStale=1." },
  { num: 84, status: "FIXED", note: "Same fix as #83 — 6-month cutoff on GENERAL_SOURCES handles all stale Reddit threads. lib/reputation/freshness.ts." },
  { num: 87, status: "FIXED", note: "lib/reputation/freshness.ts DIRECT_MENTION_MAX_AGE_DAYS = 5 years (Google reviews + Yelp + Facebook). Anything older is hidden from the active feed but counted in source totals. Matches Norman's request exactly." },
  { num: 90, status: "FIXED", note: "Removed silent AutoRefresh from app/portal/visitors/page.tsx. PixelSyncButton is now the single source of truth for refresh. Header copy simplified to 'Click Sync now to pull the latest identifications.' The pixel-freshness dot in the header still shows last-event age so the operator knows when to click." },
  { num: 91, status: "FIXED", note: "app/portal/chatbot/page.tsx now leads with conversation stats (1d/7d/30d windowed counts) + recent conversation feed, with configuration controls below. Norman's exact ask: 'pull up the conversations insight to the very top, before configuration.'" },
  { num: 92, status: "IN_PROGRESS", note: "Data audit: TC has exactly 1 PopupCampaign — 'Limited availability — Telegraph' (TIME_ON_PAGE trigger, ACTIVE, created 2026-05-20). The second popup (doubles on listing page) you remember is NOT in the database. Likely never created, or created on a different org/property. If you want it, send the offer + trigger + page URL and I'll spin it up." },
  { num: 93, status: "IN_PROGRESS", note: "Data audit: the one TC popup was created 2 days ago (2026-05-20T07:12Z) with 1 shown / 0 converted. The 'data disconnect' impression is real — the popup has only been live ~48 hours, so we genuinely don't have many impressions yet. No backfill possible (popups capture impressions live; nothing to recompute). Recommend waiting ~7 days then revisit; if still flat we have a pixel/embed issue to chase." },
  { num: 97, status: "FIXED", note: "Dashboard's rent-roll / leasing surfaces (occupancy tile, lease-related cards, AppFolio mirror queries) were already stripped — see comments in app/portal/page.tsx referencing 'rent-roll cleanup' at lines 906, 964, 1063, 1187. LeaseStack positioned as marketing intelligence, not PMS." },
  { num: 100, status: "FIXED", note: "Full report-cadence config UI exists at /portal/reports/settings with cron infrastructure: weekly (Mon 07:00 UTC), monthly (1st 07:00 UTC), daily (07:30 UTC), or none. ReportCadenceForm + saveReportCadence server action wired up. Auto-send requires at least one recipient." },
  { num: 101, status: "FIXED", note: "Dashboard quick stats sweep done in app/portal/page.tsx: Leads tile has explicit '28d' window + 'X all-time' hint, Ad spend tile only renders when adSpend.spendUsd > 0 (swaps to Tours otherwise), Organic tile reads 'Unique sessions from GSC + GA4', Occupancy tile dropped + replaced with Active properties tile. PerformanceOverTime chart has the date axis Norman asked for." },
  { num: 103, status: "FIXED", note: "Dashboard 'Top properties' widget now uses withMarketableLifecycle (same gate as /portal/properties) so it only surfaces curated properties — for SG that's just Telegraph Commons. The full-property grid was already removed; the leaderboard takes 2 of 5 columns instead of dominating the dashboard. Drill-in link goes to /portal/properties." },
  { num: 104, status: "FIXED", note: "Dashboard AppFolio teaser at app/portal/page.tsx renders three states based on the actual connection: (1) amber 'Auto-sync paused' when connected but disabled, (2) green 'AppFolio connected · {subdomain}' when fully connected, (3) blue 'Connect AppFolio' CTA when not connected. Already dynamic per client; SG sees the green connected state." },
  { num: 107, status: "FIXED", note: "Settings page count now reads from getConnectStatusForOrg (same canonical source as /portal/connect). The 3-vs-6 drift was from an older ad-hoc per-table query — consolidated so the two pages can never disagree again." },
  { num: 108, status: "FIXED", note: "Marketplace card description on /portal/settings already reads 'Activate add-on modules — every module is free to try during your trial (excluding Pro add-ons).' The marketplace page metadata + hero copy carry the same caveat." },
];

(async () => {
  for (const fix of FIXES) {
    const b = await prisma.bugReport.findFirst({ where: { githubIssueNumber: fix.num } });
    if (!b) { console.log(`#${fix.num}: NOT FOUND`); continue; }
    const tl = Array.isArray(b.timeline) ? (b.timeline as any[]) : [];
    tl.push({
      at: new Date().toISOString(),
      by: "system",
      byEmail: "demo-prep@leasestack.co",
      kind: "status",
      from: b.status,
      to: fix.status,
      text: fix.note,
    });
    await prisma.bugReport.update({
      where: { id: b.id },
      data: { status: fix.status, resolutionNote: fix.note, timeline: tl as any },
    });
    console.log(`#${fix.num} -> ${fix.status}`);
  }
  await prisma.$disconnect();
})();
