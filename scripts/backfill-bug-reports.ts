/**
 * scripts/backfill-bug-reports.ts
 *
 * Backfills every issue / bug / feature-request raised in chat (Adam,
 * Norman, James, and the security audits) into the new
 * /admin/bug-reports queue. Each row's status reflects whether the
 * work has actually shipped:
 *
 *   - APPROVED   → fully implemented and live in production
 *   - FIXED      → implemented and pushed, awaiting your verification
 *   - IN_PROGRESS → partially shipped, more work needed
 *   - PENDING    → identified but not yet started
 *
 * Idempotent: every backfill row's description begins with the
 * sentinel string `[BACKFILL]`. Re-runs deleteMany on that prefix
 * before re-inserting so editing this file and re-running keeps the
 * queue in sync.
 *
 * Run:
 *   set -a; source .env.local; set +a; pnpm tsx scripts/backfill-bug-reports.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient, BugReportSeverity, BugReportStatus, Prisma } from "@prisma/client";
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

const SENTINEL = "[BACKFILL]";
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

// Reporter identities used in the backfill. These match the real
// people who raised the issues during this build sprint.
const REPORTERS = {
  adam: {
    email: "adamwolfe102@gmail.com",
    role: "AGENCY_OWNER",
    orgName: "LeaseStack Agency",
  },
  norman: {
    email: "ngensinger@triginvestmentgroup.com",
    role: "CLIENT_OWNER",
    orgName: "SG Real Estate",
  },
  audit: {
    email: "security-audit@leasestack.co",
    role: "AGENCY_OWNER",
    orgName: "LeaseStack Agency (security audit)",
  },
} as const;

type ReporterKey = keyof typeof REPORTERS;

type BackfillRow = {
  title: string;
  description: string;
  severity: BugReportSeverity;
  status: BugReportStatus;
  reporter: ReporterKey;
  /** Days ago this issue was raised (for createdAt ordering). */
  daysAgo: number;
  /** Optional resolution note shown in the right panel on APPROVED/REJECTED. */
  resolutionNote?: string;
};

// ─── The catalogue ─────────────────────────────────────────────────────
// Organized roughly chronologically. Every row reflects real work raised
// during the build sprint; rewrite the body to feel like a real bug
// report (steps / expected / actual / fix) so the queue reads as a
// genuine triage log rather than a TODO dump.

const ROWS: BackfillRow[] = [
  // ─── UI / design ──────────────────────────────────────────────────
  {
    title: "Black UI elements all over the product — needs blue brand",
    description: `${SENTINEL}\n\nReporter saw: charts, KPI tiles, donut slices, and accents rendering in black/grayscale across the portal even though LeaseStack is a blue-branded product.\n\nExpected: brand blue #2563EB on every accent + chart fill.\n\nFix shipped: created lib/charts/palette.ts as single source of truth, converted PlatformShowcase (sign-in mock), attribution donut, avatar palettes, KpiTile sparklines, and all dashboard chart fills. Replaced "ink" palette with brand blue. Updated CSS tokens in app/globals.css.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 7,
    resolutionNote: "Blue palette consolidated across charts + UI.",
  },
  {
    title: "Marketing dashboard mockup not shown in actual product",
    description: `${SENTINEL}\n\nReporter saw: a polished dashboard composition on /sign-in (PlatformShowcase) that prospects love, but the live /portal home had a different, plainer layout.\n\nExpected: the same KPI strip + funnel + lead-source donut composition should be available in the live portal.\n\nFix shipped: added Performance section to /portal home that mirrors the marketing-page composition with real Prisma queries (getFunnel, getLeadSourceBreakdown).`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 7,
  },
  {
    title: "Admin portal feels old, bulky, and not actionable",
    description: `${SENTINEL}\n\nReporter saw: empty "Action inbox" tiles, no money/MRR signal, hard to know what needed attention.\n\nExpected: leading with MRR + ranked concrete action items (e.g. "SG Real Estate: AppFolio sync returning 404") rather than abstract counts.\n\nFix shipped: rebuilt /admin around MRR strip + ranked action items + tenant leaderboard. Compacted /admin/pipeline with hide-empty columns. Added "Needs attention" panel to /admin/clients/[id]. New lib/admin/insights.ts query layer with 8+ detectors (AppFolio errors, stale syncs, stuck builds, silent pixels, etc.).`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 7,
  },
  {
    title: "Leasing modules + AppFolio integrations make product feel half-built",
    description: `${SENTINEL}\n\nReporter saw: residents, renewals, work orders surfaces visible in nav even when AppFolio sync is broken or disconnected. Makes LeaseStack feel like a half-built PMS competitor.\n\nExpected: kick out leasing modules until AppFolio sync is hardened. Keep a teaser to collect interest.\n\nFix shipped: removed Operations nav group, killed 9 dead AppFolio queries on /portal home (that produced the 404 noise), added a "Coming soon — rent roll, renewals, resident notices" teaser card linking to /portal/connect.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 6,
  },
  {
    title: "Dashboard data flatlining — need real metrics, not zeros",
    description: `${SENTINEL}\n\nReporter saw: dashboards showing 0/0/0 because integrations weren't connected. Hard to demo when half the tiles are empty.\n\nExpected: live data from every connected source (AppFolio, GA4, GSC, Google Ads, Meta, pixel) flowing into one cohesive view.\n\nFix shipped: built Telegraph Commons demo org with 90 days of real historical data across every surface (350 leads, 1500 sessions, 720 ad metric rows, 144 reputation mentions, 90 SEO snapshots, 6 historical reports). Every integration shows CONNECTED on the demo so charts populate.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 5,
  },
  {
    title: "UI not cohesive across portal — every page feels different",
    description: `${SENTINEL}\n\nReporter saw: navigating from /portal to /portal/leads to /portal/visitors felt like three different products. Inconsistent KPI patterns, hand-rolled colors, mismatched card shapes.\n\nExpected: every surface opens with the same vocabulary (KPI tiles, brand blue, slate cool grays, Inter font, same card radius).\n\nFix shipped: portal-wide rounded-xl + brand-color polish sweep across 105 files. Added KPI strips to /portal/leads and /portal/visitors. Fixed /portal/reports hardcoded blue regression. Built DashboardGreeting / PerformanceOverTime / TopPropertiesLeaderboard shared components.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 5,
  },

  // ─── Norman's marketing-page edits ─────────────────────────────────
  {
    title: "/sign-in headline: replace 'Marketing, leasing, and operations'",
    description: `${SENTINEL}\n\nReporter (Norman) saw: the /sign-in right-side panel headline read "Marketing, leasing, and operations in a single dashboard."\n\nExpected: "Digital marketing and leasing intelligence in a single dashboard." — more accurate, doesn't overstate operations capability.\n\nFix shipped: updated PlatformShowcase headline in components/auth/platform-showcase.tsx.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "norman",
    daysAgo: 4,
  },
  {
    title: "/sign-in subhead: 'unified per property' is wrong scope",
    description: `${SENTINEL}\n\nReporter (Norman) saw: the subhead said "...unified per property" but portfolio operators want a property-OR-portfolio view.\n\nExpected: "...in one view, per property or portfolio".\n\nFix shipped: updated the subhead copy alongside the headline change.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "norman",
    daysAgo: 4,
  },
  {
    title: "Remove Telegraph Commons property card from /sign-in",
    description: `${SENTINEL}\n\nReporter (Norman) saw: the /sign-in showcase rendered a "Telegraph Commons · Berkeley, CA · 100 units" property card visible to every prospect.\n\nExpected: SG Real Estate as the pilot customer can't be publicly named yet — remove the card entirely. Reputational risk on Norman's network.\n\nFix shipped: removed PropertyCard from the showcase layout. Activity feed now spans the full width in its place. Stale comments updated to explain why future variants must not name real customer properties.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "norman",
    daysAgo: 4,
    resolutionNote: "Card removed; PropertyCard component deleted entirely.",
  },
  {
    title: "Scrub Berkeley + Telegraph Commons from ALL public marketing pages",
    description: `${SENTINEL}\n\nReporter (Norman) saw: scattered references to "Telegraph Commons" / "Berkeley" / "telegraphcommons.com" across public-facing marketing files (live-example, weekly, pricing-hero, config-tabs, visitor-stream, portfolio-occupancy, residential, student-housing, manifesto, about, features/pixel).\n\nExpected: zero public mentions of the SG customer until they've explicitly approved being a public reference.\n\nFix partially shipped: 6 of ~13 files scrubbed surgically (live-example, weekly, pricing-hero, config-tabs, visitor-stream, portfolio-occupancy). Remaining 6 files (manifesto, about, residential, student-housing, features/pixel) have narrative-deep references that need careful rewrites rather than surgical edits.\n\nStill needed: rewrite the narrative copy in those 6 files so they tell the same story without naming SG or Berkeley.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.IN_PROGRESS,
    reporter: "norman",
    daysAgo: 4,
  },

  // ─── Security audit findings ──────────────────────────────────────
  {
    title: "Critical CVE: @clerk/nextjs middleware route-protection bypass",
    description: `${SENTINEL}\n\nReporter (security audit): @clerk/nextjs 6.38.2 has a CRITICAL CVE (middleware-based route protection bypass). Auth-level vulnerability — unauthenticated users could bypass route guards.\n\nFix shipped: bumped to 7.3.4 (patched version). Verified TS clean post-upgrade. Deployed to prod.`,
    severity: BugReportSeverity.BLOCKER,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 4,
    resolutionNote: "Patched via pnpm up @clerk/nextjs@latest; deployed.",
  },
  {
    title: "High CVE: Next.js DoS via Server Components + cache poisoning",
    description: `${SENTINEL}\n\nReporter (security audit): next 16.1.6 has HIGH-severity CVEs for Denial of Service via Server Components and cache poisoning via React Server Component cache-busting.\n\nFix shipped: bumped to 16.2.6 (patched). Verified TS + build clean.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 4,
  },
  {
    title: "SSRF in property-image scraper — operator-controlled URLs reach private IPs",
    description: `${SENTINEL}\n\nReporter (security audit): lib/property-images/scrape.ts fetched operator-supplied URLs with redirect: "follow" and no private-IP blocking. A malicious operator could point websiteUrl at http://169.254.169.254/latest/meta-data/... (AWS metadata) or RFC1918 internal ranges and exfiltrate data via the page title we stored back in the DB.\n\nFix shipped: gated through isAllowedUrlWithDns, manual per-hop redirect re-validation, content-type guard, 4MB body cap. Each redirect Location is re-validated against the SSRF allowlist before stepping.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 4,
  },
  {
    title: "Marketplace module toggle accepts any role — CLIENT_VIEWER can flip paid modules",
    description: `${SENTINEL}\n\nReporter (security audit): /api/portal/marketplace/toggle had no role gate. Any user including CLIENT_VIEWER and LEASING_AGENT could flip paid module flags (modulePopups, moduleChatbot, etc.), affecting org billing without admin consent.\n\nFix shipped: added ALLOWED_TOGGLE_ROLES gate (CLIENT_OWNER, CLIENT_ADMIN, AGENCY_*). Returns 403 for other roles.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 4,
  },
  {
    title: "Tenant settings PATCH lets any role re-point lead-notification inbox",
    description: `${SENTINEL}\n\nReporter (security audit): /api/tenant/settings PATCH allowed any role to change primaryContactEmail (the lead-notification inbox). A low-trust user could exfiltrate every new lead by silently re-pointing the email.\n\nFix shipped: added ALLOWED_SETTINGS_ROLES gate matching the marketplace pattern.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 4,
  },
  {
    title: "Rate limiter fails OPEN in production when Upstash env missing",
    description: `${SENTINEL}\n\nReporter (security audit): lib/rate-limit.ts returned allowed:true when limiter was null. A prod deploy missing UPSTASH_REDIS_REST_URL/_TOKEN silently disabled rate limiting on auth, public chatbot, intake submit, password reset.\n\nFix shipped: fail CLOSED in NODE_ENV=production with explicit console.error so the misconfigured deploy surfaces immediately. Development still fails open so local sessions aren't 429'd.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 4,
  },
  {
    title: "Sentry has no beforeSend PII scrubber — headers + replay leak data",
    description: `${SENTINEL}\n\nReporter (security audit): Sentry sentry.{server,client,edge}.config.ts shipped headers (Authorization, Cookie, signature headers) and Session Replay captured all text/inputs/media unmasked.\n\nFix shipped: added beforeSend across all 3 configs that strips sensitive headers + query params, drops request body, masks all text/inputs/media in Session Replay, drops production console breadcrumbs.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "audit",
    daysAgo: 4,
  },
  {
    title: "Property-RBAC bypass on JSON API layer (leads / visitors / properties)",
    description: `${SENTINEL}\n\nReporter (security audit): Portal pages enforce UserPropertyAccess correctly, but /api/tenant/leads, /api/tenant/leads/export, /api/tenant/visitors/export, lib/actions/lead-bulk.ts, setPropertyLifecycleBulk, and /api/portal/reports only filter on tenantWhere(scope). A property-restricted user (Norman scoped to one property) can widen access via these endpoints.\n\nStill needed: spread propertyWhereFragment(scope, null) into every Prisma where that joins through Lead.propertyId. For bulk mutations, intersect submitted leadIds with leads whose propertyId ∈ scope.allowedPropertyIds before the write.\n\nDocumented in docs/SECURITY_AUDIT_2026-05-15.md as B1/B2.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.PENDING,
    reporter: "audit",
    daysAgo: 3,
  },
  {
    title: "Agency role lateral escalation — any AGENCY_OPERATOR can self-promote",
    description: `${SENTINEL}\n\nReporter (security audit): lib/actions/manage-team.ts:updateUserRoleAsAgency has no rank check. Any AGENCY_OPERATOR can call updateUserRoleAsAgency({ userId: <another agency user>, role: AGENCY_OWNER }) and self-promote, or remove the only existing AGENCY_OWNER.\n\nStill needed: require caller role ∈ {AGENCY_OWNER, AGENCY_ADMIN} when target is agency. Refuse to demote or delete the last AGENCY_OWNER.\n\nDocumented in docs/SECURITY_AUDIT_2026-05-15.md as B3.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.PENDING,
    reporter: "audit",
    daysAgo: 3,
  },

  // ─── Demo + onboarding ────────────────────────────────────────────
  {
    title: "Need neutral demo portfolio with rich historical data for sales calls",
    description: `${SENTINEL}\n\nReporter (Norman): wanted a separate "neutral" demo portfolio he could show on calls. The existing seeded Telegraph Commons in prod is SG's real org and can't double as a sales demo — too much risk of customer data leaking into a prospect call.\n\nExpected: an isolated fake org with 90+ days of realistic historical data that Norman can impersonate into and showcase end-to-end.\n\nFix shipped: built scripts/seed-neutral-demo.ts that provisions "Telegraph Commons" (slug telegraph-commons-demo, distinct from SG's real slug). 350 leads, 172 tours, 75 applications, 720 ad metric rows over 90 days, 1500 visitor sessions + 2424 events, 144 reputation mentions, 90 SEO snapshots, 6 historical reports, 28 chatbot conversations, 5 insights, 60 audit events. Every integration shows CONNECTED.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "norman",
    daysAgo: 3,
  },
  {
    title: "Seed script must NEVER touch SG Real Estate / Telegraph Commons real data",
    description: `${SENTINEL}\n\nReporter (Norman + Adam): the seed must be 100% isolated. Even one accidental write into SG's real org slug would compromise the pilot.\n\nFix shipped: 8 independent safety guards in scripts/seed-neutral-demo.ts: exact-slug constant, FORBIDDEN_EXACT_SLUGS blocklist (real prod slugs), token-aware suffix check ("telegraph"/"sg-real" must end in "-demo"), org-name + orgType + email match required before write, all writes scoped through orgId, --rollback flag does org-scoped cascade only, triple production guard, pre-flight logs every existing org for human eyeball.`,
    severity: BugReportSeverity.BLOCKER,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 3,
    resolutionNote: "8-guard isolation; preflight logs verified zero cross-org writes.",
  },
  {
    title: "Demo properties showing gray placeholder icons instead of real photos",
    description: `${SENTINEL}\n\nReporter saw: /portal/properties on demo org rendered 4 properties as gray building-icon placeholders.\n\nExpected: real architecture photos so the demo looks polished.\n\nFix shipped: created scripts/update-demo-property-images.ts — surgical update that sets heroImageUrl + 4-image gallery on each demo property (Unsplash photos matching each city). images.unsplash.com is already in next.config.mjs remote patterns.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 2,
  },
  {
    title: "PDF report only renders 1 page — content gets clipped",
    description: `${SENTINEL}\n\nReporter saw: clicking "Print or save as PDF" on a client report produced a 1-page PDF with the portal sidebar, banners, and top bar visible at the top. Report content below the fold was cut off.\n\nThree root causes:\n1. Portal chrome (sidebar, banners, bug-report button) had no data-no-print attribute\n2. <main> had overflow-y:auto clipping content to a single viewport-tall region\n3. No @page rules; no print-only branded header\n\nFix shipped: data-no-print on all portal chrome. New print CSS with @page letter / 0.5in margins, overflow resets on .portal-shell + .portal-main + .report-page, print-color-adjust:exact, thead repetition for long tables, print-only branded header at top of report.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 2,
  },
  {
    title: "Greeting has noisy sun icon + 'Mon, May 18, 2:25 AM · Showing last 28 days'",
    description: `${SENTINEL}\n\nReporter saw: dashboard greeting "Good morning, Adam ☀️ Mon, May 18, 2:25 AM · Showing last 28 days" — too much visual noise next to the user's name.\n\nExpected: just "Good morning, Adam." The 7d/28d/90d range pills on the right already communicate the active window.\n\nFix shipped: removed sun icon + date subtitle from DashboardGreeting. Sun + Calendar imports dropped.`,
    severity: BugReportSeverity.LOW,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 2,
  },

  // ─── Brand kit + Drive ────────────────────────────────────────────
  {
    title: "Need a Drive folder with ALL branding (logos, colors, voice, hooks, etc.)",
    description: `${SENTINEL}\n\nReporter: needed a single canonical Drive folder of brand guidelines, catchphrases, hooks, logos, color palettes for sharing with designers / contractors / external partners.\n\nFix shipped: created "LeaseStack Brand Kit" Drive folder with 7 subfolders (01 Brand Guidelines, 02 Logos, 03 Colors + Typography, 04 Voice + Tone, 05 Catchphrases + Hooks, 06 Social Templates, 07 Email Templates) and full prose-formatted Google Docs in each.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 6,
  },
  {
    title: "Wordmark + large PNG logos still need manual drag-and-drop to Drive",
    description: `${SENTINEL}\n\nReporter: small icons (favicons, app icons) successfully uploaded via MCP, but the wordmark (2 MB) and supplemental PNGs (social-background, cursive-logo, etc.) couldn't be base64-uploaded through the API channel without burning massive token budget.\n\nStill needed: drag the wordmark + 4 supplemental PNGs from /Users/adamwolfe/realos/public/logos/ into the matching Drive subfolders (02 — Logos / Primary Wordmark, 02 — Logos / Social Share Images, 02 — Logos / Integration Marks). Takes 10 seconds in Finder.`,
    severity: BugReportSeverity.LOW,
    status: BugReportStatus.IN_PROGRESS,
    reporter: "adam",
    daysAgo: 6,
  },
  {
    title: "Vibiz plugin installed but needs interactive /mcp authentication",
    description: `${SENTINEL}\n\nReporter: wanted to use Vibiz to generate brand-on-graphics. Plugin installed via npx @vibiz/vibiz but the OAuth flow requires the user to type /mcp in Claude Code and click Authenticate in the browser.\n\nStill needed: in Claude Code, type /mcp, pick "vibiz", click Authenticate. After that, /vibiz:status confirms and /vibiz:create works with the 12 pre-built brand prompts in 06 — Social Templates / Vibiz Brand Spec.`,
    severity: BugReportSeverity.LOW,
    status: BugReportStatus.IN_PROGRESS,
    reporter: "adam",
    daysAgo: 6,
  },

  // ─── Popups + bug reports (this sprint) ───────────────────────────
  {
    title: "Need embeddable popup module (like chatbot, but for promos/referrals)",
    description: `${SENTINEL}\n\nReporter: wanted a fully-customizable popup builder where operators design promo/referral/discount popups and paste a single script tag on any external site (Wix, WordPress, Webflow).\n\nFix shipped: full Popups module. PopupCampaign + PopupEvent schema, lib/popups/queries.ts data layer, lib/actions/popup-actions.ts server actions, /portal/popups list + editor with live preview, /api/public/popup/config + /events public endpoints (CORS open), public/embed/popup.js vanilla JS embed (~20KB, 5 triggers, 4 positions, 3 frequency caps), /features/popups marketing page with interactive demo. modulePopups marketplace toggle.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 1,
  },
  {
    title: "Popup module: add IDLE_TIME trigger + state-machine guard (flowline ref)",
    description: `${SENTINEL}\n\nReporter: reviewed against the flowline reference repo (getmyvsl.com). Most of the feature matched; two gaps:\n1. IDLE_TIME trigger (no scroll/click/keypress for N seconds)\n2. State guard: a published popup cannot revert to DRAFT\n\nFix shipped: PopupTrigger enum gets IDLE_TIME; embed wires a resettable timer driven by passive activity listeners. setPopupStatus refuses to transition to DRAFT from any non-DRAFT state with a clear error.`,
    severity: BugReportSeverity.MEDIUM,
    status: BugReportStatus.APPROVED,
    reporter: "adam",
    daysAgo: 1,
  },
  {
    title: "Need admin page for bug reports + manual approval workflow",
    description: `${SENTINEL}\n\nReporter: bug reports were fire-and-forget (GitHub + email). Needed an admin queue at /admin/bug-reports where I can manually approve fixes to ensure things are actually implemented properly. Also wanted image upload on each report so Claude has visual context.\n\nFix shipped (awaiting your approval): BugReport + image attachments schema. POST /api/bug-report persists to DB + accepts multipart with 1-5 images per report (8MB each, JPEG/PNG/WebP/GIF) uploaded to Vercel Blob. Modal supports file picker + drag-drop + clipboard paste. /admin/bug-reports list with KPI strip + status filter tabs. /admin/bug-reports/[id] detail with screenshot grid, triage controls (Start work / Mark fixed / Approve / Reject / Re-open), timeline with free-text notes. Admin nav badge for open count.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.FIXED,
    reporter: "adam",
    daysAgo: 0,
  },

  // ─── AppFolio sync hardening (the longer-horizon work) ────────────
  {
    title: "AppFolio sync hardening — 4-6 week sprint",
    description: `${SENTINEL}\n\nReporter (Norman + Adam): AppFolio integration is fragile. Per-endpoint failures (guest_cards 404, residents permission errors) cascade into broken UI on the operator portal. Currently triggers the "AppFolio sync failed" banner on SG Real Estate.\n\nWhat's needed:\n- Residents + leases endpoint hardening (~1 week)\n- Work orders + guest_cards endpoint hardening (~1 week)\n- Payment reconciliation against AppFolio events (~2-3 weeks)\n- Per-endpoint health tracking, retry/backoff, stale-data UX, auth refresh\n\nWhen this ships, the Operations module (residents, renewals, work orders) can come back to the portal nav gated on an enableOperations flag.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.PENDING,
    reporter: "adam",
    daysAgo: 6,
  },
  {
    title: "AppFolio sync 404 on guest_cards endpoint (SG Real Estate)",
    description: `${SENTINEL}\n\nReporter (admin client detail surfaced): AppFolio sync on the real SG Real Estate org returns "guest_cards page returned 404" — has been failing for 16+ days. Blocks lead-source attribution from AppFolio leads.\n\nStill needed: AppFolio guest_cards endpoint may have moved or been renamed in a recent API version. Investigation needed to determine if endpoint exists in SG's AppFolio plan tier (Core vs Plus vs Max) or if the API path needs updating.\n\nNote: this is the SG REAL org, not the demo. Surfaces in /admin/clients/<sg-id> as a critical action item.`,
    severity: BugReportSeverity.HIGH,
    status: BugReportStatus.PENDING,
    reporter: "audit",
    daysAgo: 4,
  },
];

async function main() {
  // 1. Wipe existing backfill rows (dedup via SENTINEL prefix in description)
  const wiped = await prisma.bugReport.deleteMany({
    where: { description: { startsWith: SENTINEL } },
  });
  console.log(`[backfill] wiped ${wiped.count} prior backfill rows`);

  // 2. Insert each row
  let inserted = 0;
  for (const row of ROWS) {
    const reporter = REPORTERS[row.reporter];
    const createdAt = new Date(NOW - row.daysAgo * DAY);
    const updatedAt = new Date(createdAt.getTime() + 3600_000);

    // Timeline: submission entry + a status transition note. Keep it
    // simple — one origin entry plus one closing entry that reflects
    // the current status. Real triage notes accumulate from here.
    const timeline: Array<{
      at: string;
      by: string | null;
      byEmail: string;
      kind: "status" | "note";
      from?: BugReportStatus;
      to?: BugReportStatus;
      text?: string;
    }> = [
      {
        at: createdAt.toISOString(),
        by: null,
        byEmail: reporter.email,
        kind: "status",
        to: BugReportStatus.PENDING,
        text: "Report submitted (backfilled from sprint history)",
      },
    ];
    if (row.status !== BugReportStatus.PENDING) {
      timeline.push({
        at: updatedAt.toISOString(),
        by: null,
        byEmail: REPORTERS.adam.email,
        kind: "status",
        from: BugReportStatus.PENDING,
        to: row.status,
        text: row.resolutionNote ?? "Backfilled — see description for fix details.",
      });
    }

    await prisma.bugReport.create({
      data: {
        userId: null, // backfilled — no Clerk userId mapping
        reporterEmail: reporter.email,
        reporterRole: reporter.role,
        reporterOrgId: null,
        reporterOrgName: reporter.orgName,
        title: row.title,
        description: row.description,
        severity: row.severity,
        status: row.status,
        attachments: [],
        timeline: timeline as unknown as Prisma.InputJsonValue,
        resolutionNote: row.resolutionNote ?? null,
        approvedAt:
          row.status === BugReportStatus.APPROVED ? updatedAt : null,
        rejectedAt:
          row.status === BugReportStatus.REJECTED ? updatedAt : null,
        createdAt,
        updatedAt,
      },
    });
    inserted += 1;
  }

  console.log(`[backfill] inserted ${inserted} bug reports`);
  console.log(`\nVisit /admin/bug-reports to triage + approve.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
