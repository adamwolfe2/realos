/**
 * scripts/backfill-bug-reports-3.ts
 *
 * Round 3 of the bug-report backfill. Captures the integration-sync
 * audit findings (AppFolio false-positives, GA4/GSC lying pill,
 * Cursive pixel webhook gating, popup CONVERTED race, popup module
 * adoption). Every row's description begins with `[BACKFILL3]` so this
 * script is idempotent.
 *
 * Run:
 *   set -a; source .env.local; set +a; pnpm tsx scripts/backfill-bug-reports-3.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import {
  PrismaClient,
  BugReportSeverity,
  BugReportStatus,
  Prisma,
} from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Source .env.local first.");
}

const adapter = new PrismaNeon({
  connectionString: connectionString.replace(/-pooler\./, "."),
});
const prisma = new PrismaClient({ adapter });

const SENTINEL = "[BACKFILL3]";
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const REPORTERS = {
  adam: {
    email: "adamwolfe102@gmail.com",
    role: "AGENCY_OWNER",
    orgName: "LeaseStack Agency",
  },
  audit: {
    email: "integration-audit@leasestack.co",
    role: "AGENCY_OWNER",
    orgName: "LeaseStack Agency (integration audit)",
  },
} as const;

type ReporterKey = keyof typeof REPORTERS;

type Row = {
  title: string;
  description: string;
  severity: BugReportSeverity;
  status: BugReportStatus;
  reporter: ReporterKey;
  daysAgo: number;
  resolutionNote?: string;
};

const ROWS: Row[] = [
  // ─── AppFolio ──────────────────────────────────────────────────────
  {
    title: "AppFolio: 'sync failed' banner is a false positive on slow tenants",
    description: `${SENTINEL}\n\nReporter (Adam): the AppFolio integration banner says 'sync failed' / 'last attempt 0d ago' even when sync is functioning. Visible at the top of /portal/leads and other portal pages.\n\nRoot cause: app/api/cron/appfolio-sync/route.ts:31 auto-flipped any row in syncStatus='syncing' older than 10 min to 'error' with the message 'Sync timed out — function killed before completion.' Real tenants with >500 residents (Telegraph Commons, SG Real Estate) routinely have legitimate runs that span 7-9 min because AppFolio's reports endpoint is slow. Those in-flight runs were being prematurely marked failed.\n\nFix: raise the threshold to 8 min (Vercel maxDuration is 5 min + 3 min safety margin) and only auto-heal rows that genuinely predate the function timeout. Also lower DEFAULT_BACKFILL_DAYS from 90 to 30 in lib/integrations/appfolio-sync.ts so the initial backfill comfortably fits in 5 min.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 0,
    resolutionNote: "Threshold + backfill window tightened.",
  },

  // ─── GA4 / GSC ─────────────────────────────────────────────────────
  {
    title: "GA4/GSC: connection pill lies — shows 'Connected' even when every sync fails",
    description: `${SENTINEL}\n\nReporter (integration audit): the integration marketplace tile in /portal/connect rendered 'Connected' (green pill) for SEO + Ads tiles any time a SeoIntegration / AdAccount row existed, regardless of SeoSyncStatus.ERROR / lastSyncError. Operators saw green and assumed data was flowing — only opening the drawer or noticing zero data on /portal/seo would reveal the actual broken state.\n\nFix: new IntegrationState='error' state, surfaced from lib/integrations/status.ts when status==='ERROR' OR lastSyncError != null. New rose-toned 'Sync error' badge + 'Fix sync' CTA in components/portal/integrations/integration-tile.tsx + a rose-toned banner in the drawer. Same shape applied to AppFolio so any syncStatus='error' surfaces honestly.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 0,
    resolutionNote: "Honest 'error' state plumbed end-to-end.",
  },
  {
    title: "GA4/GSC: cron only ran every 6 hours; no on-demand refresh from /portal/seo",
    description: `${SENTINEL}\n\nReporter (Adam): SEO data was perpetually stale. Cron was scheduled '0 */6 * * *' in vercel.json — meaning a 5-hour lag between fresh GSC/GA4 data and what the operator saw. There was no manual refresh from the /portal/seo dashboard (the action button on the page didn't call a sync endpoint).\n\nFix:\n1. Cron interval dropped to '*/30 * * * *' (every 30 min).\n2. seo-sync.ts incremental window widened from 'yesterday only' to 'last 3 days' so single-tick failures self-heal and GA4 intraday + GSC late-arriving data both stay fresh.\n3. New POST /api/tenant/seo/sync endpoint mirrors the AppFolio shape.\n4. New StaleOnLoadTrigger wired into /portal/seo — when newest lastSyncAt > 30 min old, the page fires the sync endpoint on mount (60s cooldown via sessionStorage dedupe).`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 0,
    resolutionNote: "Cron + window + on-demand + stale-on-load all shipped.",
  },

  // ─── Cursive pixel ─────────────────────────────────────────────────
  {
    title: "Cursive pixel: setup forces ops to manually paste webhook URL into AL — silently skipped",
    description: `${SENTINEL}\n\nReporter (Adam): 'I have to keep pressing the sync button for the cursive pixel and it is not real time.' Root cause confirmed by audit: webhook receiver exists and works (/api/webhooks/cursive/[token]) but requires ops to manually copy the per-tenant webhook URL from /admin/clients/[id] and paste it into the AudienceLab pixel UI. When skipped, freshness collapses to the 30-min cron + on-mount manual button.\n\nFix shipped:\n1. saveCursiveSettings now runs testCursiveWebhook automatically the moment a pixelId is bound — verifies the LeaseStack receiver round-trips before fulfillment email goes to the customer. If the receiver itself is broken (rare but possible during deploys), the customer email is blocked and ops sees a clear error explaining what to fix. (Does NOT verify AL-side delivery — that still requires ops to paste the webhook URL into the AL pixel config, but at least surfaces server-side breakage immediately.)\n2. Cron interval dropped from 30 min to 5 min in vercel.json (idempotent pull, cheap).\n3. PixelSyncButton staleThresholdMs dropped from 15 min to 2 min so the on-mount sync covers the gap when the primary webhook path is unconfigured.\n4. Real-time freshness dot on /portal/visitors header: green if last event < 5 min, amber 5-30 min, rose > 30 min or never. Operator can see at-a-glance whether webhook is live, cron-only, or stale.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 0,
    resolutionNote: "Webhook gate + cron + threshold + freshness dot shipped.",
  },
  {
    title: "Cursive pixel: setup is tedious — multi-step copy-paste between two dashboards",
    description: `${SENTINEL}\n\nReporter (Adam): 'It's an extremely tedious process to set up the pixel each time.' Current flow requires:\n1. Customer fills /portal/settings/integrations request (1 step)\n2. Ops waits up to 1 business day\n3. Ops logs into AL, manually creates V4 pixel (AL has no API for V4 pixel creation per code comment in admin-cursive.ts:13)\n4. Ops manually creates segment in AL\n5. Ops pastes 3 fields (pixelId, segmentId, domain) into LeaseStack admin\n6. Ops copies generated webhook URL and pastes into AL pixel UI\n7. Ops clicks 'Test webhook'\n8. Customer pastes snippet into site head\n\nDeferred (no AL API): steps 3+4 must remain manual until AudienceLab exposes a V4 pixel/segment creation API. We've reduced friction in step 6 by automating the receiver self-test on save (see related ticket) and added a freshness dot so ops can see whether step 6 was actually completed. Future work: add a Bloo.io recipe to drive the AL UI when a request lands.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.IN_PROGRESS,
    reporter: "adam",
    daysAgo: 0,
    resolutionNote: "Receiver self-test + freshness dot shipped; AL API gating remaining.",
  },

  // ─── Popup ─────────────────────────────────────────────────────────
  {
    title: "Popup: CONVERTED event written by embed in separate fetch — race with Lead create",
    description: `${SENTINEL}\n\nReporter (popup audit): the embed's onSubmit handler in public/embed/popup.js called submitLead (→ POST /api/public/popup/lead) AND then recordEvent(CONVERTED) as two independent network calls. If the lead capture succeeded but the event POST failed (network blip, ad blocker, page unload mid-fetch), the Lead row existed but convertedCount on PopupCampaign was never incremented — campaign analytics undercount conversions.\n\nFix: CONVERTED event recording moved server-side into /api/public/popup/lead so it runs atomically with the Lead create. The embed now only fires the client-side CONVERTED fallback when the lead capture itself didn't return ok — preserving the safety net for the rare case where the lead POST fails entirely.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 0,
    resolutionNote: "Atomically recorded server-side.",
  },
  {
    title: "Popup: formatTrigger missing IDLE_TIME label",
    description: `${SENTINEL}\n\nReporter (popup audit): app/portal/popups/page.tsx:175 formatTrigger() switched on EXIT_INTENT, SCROLL_DEPTH, TIME_ON_PAGE, IMMEDIATE — but not IDLE_TIME (which the PopupTrigger enum exposes and the embed implements). Popups using IDLE_TIME rendered the raw enum string in the list row subtitle.\n\nFix: added the case.`,
    severity: BugReportSeverity.LOW,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 0,
  },
];

async function main() {
  console.log(`[backfill3] starting — ${ROWS.length} rows to seed`);

  const deleted = await prisma.bugReport.deleteMany({
    where: { description: { startsWith: SENTINEL } },
  });
  console.log(`[backfill3] cleared ${deleted.count} prior [BACKFILL3] rows`);

  const approver = await prisma.user.findFirst({
    where: { email: "adamwolfe102@gmail.com" },
    select: { id: true },
  });

  let inserted = 0;
  for (const row of ROWS) {
    const reporter = REPORTERS[row.reporter];
    const createdAt = new Date(NOW - row.daysAgo * DAY);
    const isResolved =
      row.status === BugReportStatus.APPROVED ||
      row.status === BugReportStatus.FIXED ||
      row.status === BugReportStatus.REJECTED;

    const timeline: Array<Record<string, unknown>> = [
      {
        at: createdAt.toISOString(),
        by: null,
        byEmail: reporter.email,
        kind: "status",
        from: null,
        to: BugReportStatus.PENDING,
        text: "Filed via integration audit",
      },
    ];
    if (row.status !== BugReportStatus.PENDING) {
      timeline.push({
        at: new Date(createdAt.getTime() + 30 * 60 * 1000).toISOString(),
        by: approver?.id ?? null,
        byEmail: "adamwolfe102@gmail.com",
        kind: "status",
        from: BugReportStatus.PENDING,
        to: row.status,
        text: row.resolutionNote,
      });
    }

    await prisma.bugReport.create({
      data: {
        title: row.title,
        description: row.description,
        severity: row.severity,
        status: row.status,
        reporterEmail: reporter.email,
        reporterRole: reporter.role,
        reporterOrgName: reporter.orgName,
        createdAt,
        updatedAt: createdAt,
        approvedAt: row.status === BugReportStatus.APPROVED ? new Date() : null,
        approvedBy: row.status === BugReportStatus.APPROVED ? approver?.id ?? null : null,
        resolutionNote: isResolved ? row.resolutionNote ?? null : null,
        timeline: timeline as unknown as Prisma.InputJsonValue,
      },
    });
    inserted++;
  }

  console.log(`[backfill3] inserted ${inserted} rows. Done.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[backfill3] failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
