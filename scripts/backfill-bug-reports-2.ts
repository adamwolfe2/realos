/**
 * scripts/backfill-bug-reports-2.ts
 *
 * Round 2 of the bug-report backfill. Captures the security findings
 * (H1–H4 + B1–B3 RBAC sweep + protobufjs CVE) and code-quality
 * findings from the post-rebrand re-audit. Every row's description
 * begins with the sentinel string `[BACKFILL2]` so this script can
 * be re-run without colliding with `[BACKFILL]` (the original sweep).
 *
 * Run:
 *   set -a; source .env.local; set +a; pnpm tsx scripts/backfill-bug-reports-2.ts
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

const SENTINEL = "[BACKFILL2]";
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const REPORTERS = {
  audit: {
    email: "security-audit@leasestack.co",
    role: "AGENCY_OWNER",
    orgName: "LeaseStack Agency (security audit)",
  },
  review: {
    email: "code-review@leasestack.co",
    role: "AGENCY_OWNER",
    orgName: "LeaseStack Agency (code review)",
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
  // ─── HIGH security findings (H1–H4) ────────────────────────────────
  {
    title: "H1: popup config cache-bust via long ?property= query value",
    description: `${SENTINEL}\n\nFile: app/api/public/popup/config/[slug]/route.ts\n\nReporter (security re-audit) saw: the public popup config endpoint accepted an arbitrary-length ?property= query value with no cap. Combined with the s-maxage=60 CDN cache header, a malicious site could cache-bust by varying ?property= to long random strings — each request lands a unique CDN entry, eventually evicting hot keys and forcing every legitimate visitor to round-trip to origin.\n\nSecondary leak: the success branch set Cache-Control but the org-missing / module-disabled branches did not. A slug-enumeration attacker could infer org existence from a cache-state difference.\n\nFix shipped:\n1. Cap propertySlug at 100 chars before passing into the query layer.\n2. Hoist cacheHeaders into a single const applied uniformly to all three response branches.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Cap + uniform cache headers shipped.",
  },
  {
    title: "H2: popup events endpoint can be hammered to inflate counters",
    description: `${SENTINEL}\n\nFile: app/api/public/popup/events/route.ts\n\nReporter (security re-audit) saw: the public popup events endpoint had no rate limit and no dedupe. A competitor who scrapes a victim's popupId from a script tag could permanently inflate shownCount / convertedCount by hammering the endpoint — ruining the operator's CTR/conversion attribution and making the campaign look like garbage in the analytics view.\n\nFix shipped:\n1. New popupEventLimiter (60/min/IP) in lib/rate-limit.ts.\n2. Per-session dedupe window for SHOWN/DISMISSED events (24h) so the same sessionId+type combo cannot bump counters twice. CTA_CLICKED / CONVERTED stay unfiltered because legitimate users CAN click + convert across multiple sessions.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Rate limit + per-session dedupe shipped.",
  },
  {
    title: "H3: popup actions accept javascript: ctaUrl — full XSS on embedders",
    description: `${SENTINEL}\n\nFile: lib/actions/popup-actions.ts + public/embed/popup.js\n\nReporter (security re-audit) saw: the popup editor schema accepted any z.string() for ctaUrl. An operator (or compromised operator account) could publish a popup with ctaUrl="javascript:fetch('/steal?cookie='+document.cookie)" and execute arbitrary JS on every third-party site running the LeaseStack popup embed — full XSS on the embedding domain, including paying customers' marketing sites.\n\nSame shape applied to heroImageUrl with data:text/html.\n\nFix shipped:\n1. Scheme allow-list (http, https, mailto, tel) for ctaUrl; (http, https) for heroImageUrl.\n2. Relative URLs (/apply, #contact, ?utm=…) explicitly allowed — they're resolved against the embedder's origin and are safe.\n3. Defense-in-depth on the client: safeNavTarget() helper in popup.js validates again before location.href assignment.\n4. Also fixed the cross-popup state leak (a shared 'fired' var leaked between popup instances) by wrapping each trigger branch in an IIFE so each popup gets its own state.\n5. Added document.currentScript fallback (querySelector by src match) so async script tags don't lose their config.`,
    severity: BugReportSeverity.BLOCKER,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Scheme allow-list + client guard + IIFE isolation shipped.",
  },
  {
    title: "H4: bug-report endpoint can drain Vercel Blob quota",
    description: `${SENTINEL}\n\nFile: app/api/bug-report/route.ts\n\nReporter (security re-audit) saw: any authenticated user could script bug-report POSTs with 5×8MB attachments and drain the platform's Vercel Blob storage quota / cost — no per-user rate limit existed.\n\nSecondary issue: safeName regex was permissive (allowed leading dots/underscores so an uploaded ".env" could mimic a config file in the bucket listing).\n\nFix shipped:\n1. New bugReportLimiter (30/hour/userId) checked BEFORE parsing the multipart body so attackers can't burn server CPU on multipart parsing.\n2. Tighter safeName regex strips leading [._]+ and any non-[a-zA-Z0-9._-] before slicing to 100 chars.\n3. Replaced the unsafe \`as unknown as never\` cast with proper Prisma.InputJsonValue typing.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Rate limit + tighter safeName + typed cast shipped.",
  },

  // ─── RBAC sweep (B1–B3) ─────────────────────────────────────────────
  {
    title: "B1: /api/tenant/leads JSON API bypasses property-RBAC gate",
    description: `${SENTINEL}\n\nFiles: app/api/tenant/leads/route.ts (GET + POST), app/api/tenant/leads/export/route.ts\n\nReporter (security re-audit) saw: the portal /portal/leads page carefully applies propertyWhereFragment(scope, propertyIds) so a leasing agent restricted to Bldg A can't see Bldg B leads. The JSON API serving the SAME data did not. A restricted user could fetch /api/tenant/leads directly (or /api/tenant/leads/export to walk away with a CSV) and bypass the gate entirely.\n\nFix shipped:\n1. /api/tenant/leads GET now applies propertyWhereFragment from the URL ?properties= filter, intersected with scope.allowedPropertyIds.\n2. /api/tenant/leads POST refuses propertyId not in the user's allowed set.\n3. /api/tenant/leads/export gated identically — exports are arguably worse to leak (CSV lives forever).\n4. /api/tenant/visitors/export gated on the same pattern (Visitor has propertyId).`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Gate shipped on all four endpoints.",
  },
  {
    title: "B2: bulk lead actions miss property-RBAC, allow cross-building mutation",
    description: `${SENTINEL}\n\nFile: lib/actions/lead-bulk.ts (4 functions)\n\nReporter (security re-audit) saw: bulkUpdateLeadStatus / bulkUnsubscribeLeads / bulkAssignLeads / bulkDeleteLeads all checked orgId on the where-clause but NOT propertyId against scope.allowedPropertyIds. A leasing agent with access to one building could pass leadIds for leads on properties they don't own and silently mutate them (or delete them entirely).\n\nFix shipped: new bulkLeadPropertyGate(scope) helper that returns a {propertyId: {in: scope.allowedPropertyIds}} fragment for restricted users (and {} for unrestricted agency operators). Threaded through all four updateMany/deleteMany calls.\n\nAlso patched setPropertyLifecycleBulk in lib/actions/properties.ts which had the same shape (a restricted operator could flip lifecycle on properties they don't own and the auto-recompute logic would refuse to revert).`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Gate threaded through all bulk endpoints.",
  },
  {
    title: "B3: agency role escalation in updateUserRoleAsAgency",
    description: `${SENTINEL}\n\nFile: lib/actions/manage-team.ts:updateUserRoleAsAgency\n\nReporter (security re-audit) saw: the function blindly trusted the input role enum. An AGENCY_OPERATOR could:\n1. Promote themselves or other operators to AGENCY_OWNER (full platform takeover).\n2. Promote a CLIENT_OWNER on a client org to AGENCY_OWNER (cross-cohort escalation).\n3. Demote the last AGENCY_OWNER, locking the tenant out of role management.\n\nFix shipped: hardened gate with four checks:\n1. Role must match target org's orgType (agency-role on AGENCY org, client-role on CLIENT org).\n2. AGENCY_OPERATOR cannot grant any AGENCY_* role and cannot change AGENCY_* roles on anyone else.\n3. Block demotion of last remaining AGENCY_OWNER (would lock org out).\n4. All gated decisions logged in the AuditEvent description.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Cross-cohort + last-owner + operator-escalation gates shipped.",
  },

  // ─── Bug-report code quality ────────────────────────────────────────
  {
    title: "Bug-report timeline read-modify-write race",
    description: `${SENTINEL}\n\nFile: lib/actions/bug-report-actions.ts (setBugReportStatus + addBugReportNote)\n\nReporter (code review) saw: setBugReportStatus did three round-trips — findUnique for status/title, getTimeline helper (another findUnique), then update with the appended timeline. Between read and write, a concurrent triage click from another admin could load the same timeline, append its own entry, and write back — losing the first admin's timeline entry. addBugReportNote had the same shape.\n\nFix shipped: folded both functions' read + update into a single prisma.$transaction. The read happens on the transaction's tx client, the update is in the same transaction, and Prisma's transaction isolation closes the race. Also dropped the now-unused getTimeline helper.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "review",
    daysAgo: 1,
    resolutionNote: "Transaction-wrapped both functions; helper removed.",
  },
  {
    title: "Popup actions: as unknown as never defeats type safety",
    description: `${SENTINEL}\n\nFiles: lib/actions/popup-actions.ts + app/api/bug-report/route.ts\n\nReporter (code review) saw: several JSON-column writes used \`as unknown as never\` to bypass Prisma's input type checking, which silently allows non-JSON-safe values (e.g. Date, Map, undefined keys) to reach Postgres.\n\nFix shipped: imported \`Prisma\` from @prisma/client and replaced the casts with \`as Prisma.InputJsonValue\`. TypeScript now validates that the value is JSON-serializable.`,
    severity: BugReportSeverity.LOW,
    status: BugReportStatus.APPROVED,
    reporter: "review",
    daysAgo: 1,
  },

  // ─── Dependency CVE ─────────────────────────────────────────────────
  {
    title: "protobufjs < 7.5.6: prototype pollution via posthog-js transitive dep",
    description: `${SENTINEL}\n\nFile: package.json (pnpm.overrides)\n\nReporter (security re-audit) saw: posthog-js transitively depends on protobufjs which has a prototype-pollution CVE (GHSA-h755-8qp9-cq85) fixed in 7.5.6. Without an override pnpm resolves an older vulnerable version.\n\nFix shipped: added \`pnpm.overrides.protobufjs = ">=7.5.6"\` to package.json. pnpm will re-resolve every dependent on next install.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 1,
    resolutionNote: "Pinned via pnpm.overrides.",
  },
];

async function main() {
  console.log(`[backfill2] starting — ${ROWS.length} rows to seed`);

  // Wipe prior [BACKFILL2] runs so this is idempotent.
  const deleted = await prisma.bugReport.deleteMany({
    where: { description: { startsWith: SENTINEL } },
  });
  console.log(`[backfill2] cleared ${deleted.count} prior [BACKFILL2] rows`);

  // Reach an agency-side user to attribute approvedBy properly. The
  // adamwolfe102@gmail.com superadmin is the safe default.
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
        text: "Filed via re-audit sweep",
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

  console.log(`[backfill2] inserted ${inserted} rows. Done.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[backfill2] failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
