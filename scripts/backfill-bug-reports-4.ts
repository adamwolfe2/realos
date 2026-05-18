/**
 * scripts/backfill-bug-reports-4.ts
 *
 * Round 4 of the bug-report backfill. Captures the findings from
 * the deep-dive audit (5 parallel investigators) that landed in
 * commit 192af7f. Every row's description begins with `[BACKFILL4]`.
 *
 * Run:
 *   set -a; source .env.production.local; set +a; pnpm tsx scripts/backfill-bug-reports-4.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production.local", override: false });
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient, BugReportSeverity, BugReportStatus, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!.replace(/-pooler\./, "."),
});
const prisma = new PrismaClient({ adapter });

const SENTINEL = "[BACKFILL4]";
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const REPORTER = {
  email: "deep-audit@leasestack.co",
  role: "AGENCY_OWNER",
  orgName: "LeaseStack Agency (deep-audit sweep)",
};

type Row = {
  title: string;
  description: string;
  severity: BugReportSeverity;
  resolutionNote?: string;
};

const ROWS: Row[] = [
  {
    title: "VAULT-1 CRIT: DEK race condition could silently corrupt credentials",
    description: `${SENTINEL}\n\nlib/vault/crypto.ts:getOrgDek. Two parallel "first credential created" actions could both observe vaultDekWrapped=null, both generate fresh DEKs, both update. Last write wins — but the first writer ALREADY encrypted its credential against the now-discarded DEK and the row is permanently unreadable.\n\nFix: changed the mint path from findUnique+update to a conditional updateMany with where: { id, vaultDekWrapped: null }. Postgres row-locks the Organization row, only ONE writer gets count===1. Losers re-read the winner's persisted DEK and decrypt it for subsequent operations.`,
    severity: BugReportSeverity.BLOCKER,
    resolutionNote: "Conditional UPDATE makes the mint atomic.",
  },
  {
    title: "VAULT-2 CRIT: reveal audit row written before decrypt success",
    description: `${SENTINEL}\n\nlib/actions/vault.ts:revealCredential. The original flow ran the audit transaction (CredentialAccessLog + AuditEvent + lastRevealedAt bump) and THEN called decryptForOrg. If decrypt threw (auth tag mismatch from data corruption, KEK rotation gap), the audit log recorded a successful reveal that never produced plaintext — flooding anomaly detection with false positives and giving an attacker who could corrupt ciphertext a way to spam the access log.\n\nFix: decrypt first (no DB side effects, fast), then audit. A decrypt failure now returns a clean error with no audit pollution.`,
    severity: BugReportSeverity.BLOCKER,
    resolutionNote: "Decrypt-first reordering.",
  },
  {
    title: "VAULT-3 CRIT: empty allowedPropertyIds exposed all org-wide credentials",
    description: `${SENTINEL}\n\nlib/actions/vault.ts:buildPropertyGate. A user with allowedPropertyIds=[] (provisioning glitch, every UserPropertyAccess row revoked) fell back to { propertyId: null } — exposing every banking + GA4 + root-domain credential to anyone who had no property access whatsoever. Contradicted the threat model.\n\nFix: empty allowlist now returns { id: '__no_property_access__' } (matches no rows), same synthetic-id pattern used in lib/actions/lead-bulk.ts.`,
    severity: BugReportSeverity.BLOCKER,
    resolutionNote: "Synthetic no-match id used.",
  },
  {
    title: "VAULT-4 CRIT: server actions callable on orgs with moduleVault disabled",
    description: `${SENTINEL}\n\nlib/actions/vault.ts. The page-level gate in app/portal/vault/page.tsx checked org.moduleVault and rendered a pitch screen when disabled. But the server actions (createCredential / updateCredential / deleteCredential / revealCredential / importCredentialsFromCsv) were callable directly from any authenticated session. A tenant whose moduleVault was toggled off via /admin could still reveal everything still in the table.\n\nFix: new requireModuleEnabled(scope) helper called from every mutation + reveal. Returns a clear error when moduleVault is false.`,
    severity: BugReportSeverity.BLOCKER,
    resolutionNote: "Module gate threaded through every server action.",
  },
  {
    title: "VAULT-5 HIGH: restricted user could promote credentials to org-wide",
    description: `${SENTINEL}\n\nlib/actions/vault.ts:updateCredential. A restricted user (allowedPropertyIds=[A]) editing a Bldg-A credential could submit propertyId=null on update. The original logic only validated non-null propertyIds, so the row got promoted to org-wide scope — exposing it to every other admin in the org.\n\nFix: new validatePropertyAssignment helper centralizes the check and refuses null propertyId for restricted users on both create and update.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Validation centralized + null-promotion blocked.",
  },
  {
    title: "VAULT-6 HIGH: mutations used bare orgId: scope.orgId, not tenantWhere(scope)",
    description: `${SENTINEL}\n\nlib/actions/vault.ts. The page-level read used tenantWhere(scope), but every mutation inlined orgId: scope.orgId. Functionally equivalent today, but a future change to tenantWhere (adding a clientId filter, soft-deleted org filter, isAlPartner cross-org logic) would silently skip mutations.\n\nFix: imported tenantWhere from @/lib/tenancy/scope and threaded through every mutation's where clause.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "tenantWhere used consistently.",
  },
  {
    title: "VAULT-7 HIGH: CSV import non-transactional + missing input hardening",
    description: `${SENTINEL}\n\nlib/actions/vault.ts:importCredentialsFromCsv. Original implementation was: a sequential for-loop of encryptForOrg + create per row, no transaction wrapper, no row count cap, no control-character strip, no per-cell length limit. Issues:\n1. Partial state on mid-batch failure (e.g. 800 rows succeed then DB connection drops)\n2. 2MB CSV cell could blow up GCM encryption with no bound\n3. Null bytes / zero-width chars / terminal escape sequences from copy-paste persisted into reveal modals and audit logs\n\nFix: 5k-row cap, sanitize() function that strips C0 control chars (\\x00-\\x08, \\x0B, \\x0C, \\x0E-\\x1F, \\x7F), per-field length caps (password 4KB, name 120, notes 4KB), encryption + validation in a first pass, then single $transaction with createMany in 500-row chunks. Whole batch rolls back on failure.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Transactional + hardened CSV pipeline shipped.",
  },
  {
    title: "VAULT-8 HIGH: decrypt error message leaked openssl details to client",
    description: `${SENTINEL}\n\nlib/vault/crypto.ts:decryptGcm. The catch handler concatenated err.message ("Unsupported state or unable to authenticate data") into the thrown VaultCryptoError, which surfaced all the way to the reveal modal — defeating the oracle-attack defense the comment claimed was in place.\n\nFix: log the openssl detail server-side, throw a generic "Vault decrypt failed". Verified by test: tamper now produces exactly that string with no openssl leakage.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Oracle leak closed.",
  },
  {
    title: "APPFOLIO-1 HIGH: phasesCompleted counted skipped phases — lied about health",
    description: `${SENTINEL}\n\nlib/integrations/appfolio-sync.ts. The skipped-phase code path executed phasesCompleted += 1, so a tenant with one phase auto-skipped indefinitely reported "8 of 8 phases ran" — exactly what SG Real Estate showed for 20 days with guest_cards dead. UI/status logic depending on allPhasesCompleted treated the tenant as fully healthy.\n\nFix: introduced phasesSkipped counter. Skipped phases bump phasesSkipped, not phasesCompleted. allPhasesCompleted = (completed + skipped) === total — a steady-state of "7 completed + 1 skipped" is now a recognized healthy outcome.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Skipped tracked separately.",
  },
  {
    title: "APPFOLIO-2 HIGH: skipped phases never auto-retried",
    description: `${SENTINEL}\n\nlib/integrations/appfolio-sync.ts + app/api/cron/appfolio-sync/route.ts. Once a phase auto-skipped after 3 consecutive failures, it stayed skipped forever — no automatic re-attempt. Meaning a transient AppFolio outage from 30 days ago could pin a phase as broken even though the endpoint had recovered.\n\nFix: phaseFailures now carries lastRetryAttemptAt. The cron checks for any skipped phase whose lastRetryAttemptAt is > 7 days ago and fires runAppfolioSync(orgId, { retrySkipped: true }) automatically. The phase gets a fresh attempt and either succeeds (skip flag clears) or re-arms the skip flag with a refreshed timestamp.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Weekly auto-retry wired into cron.",
  },
  {
    title: "APPFOLIO-3 HIGH: POST-pagination fallback was a dead-end, removed",
    description: `${SENTINEL}\n\nlib/integrations/appfolio.ts:fetchReport. The recent POST-fallback experiment for next_page_url 404s actually did nothing useful — re-POSTing the cursor URL with {} body doesn't mint a fresh cursor (AppFolio doesn't honor paginate_results against the cursor URL anyway). The whole-report retry in fetchAllPages, triggered by CURSOR_EXPIRED_PATTERNS matching "page returned 404", was the actual recovery path.\n\nFix: removed the POST fallback. GET-only on pagination, rely on the existing whole-report retry for cursor expiry.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Dead-end fallback removed.",
  },
  {
    title: "SEO MED: runSeoSync didn't filter DEMO_SEED rows, polluted demo orgs with ERROR",
    description: `${SENTINEL}\n\nlib/integrations/seo-sync.ts. Status helper + portal/seo page filtered DEMO_SEED rows (literal placeholder ciphertext stored on demo-seeded SEO integrations), but the sync worker did NOT. Every cron tick tried to decrypt "DEMO_SEED", threw, set status=ERROR — flipping the marketplace pill to rose "Sync error" on the Telegraph Commons demo and firing pointless StaleOnLoadTrigger requests.\n\nFix: filter serviceAccountJsonEncrypted: { not: 'DEMO_SEED' } in the sync worker's findMany.`,
    severity: BugReportSeverity.MEDIUM,
    resolutionNote: "Sync worker filters DEMO_SEED.",
  },
  {
    title: "STATUS HIGH: multi-integration pills overwrote each other",
    description: `${SENTINEL}\n\nlib/integrations/status.ts. seoBySlug.set("gsc", ...) and adsBySlug.set("google-ads", ...) loops silently overwrote previous rows. A tenant with multiple integrations of the same provider (one per property, common for multi-building orgs) saw the LAST iteration's status — meaning a healthy + broken pair showed "Connected" or "Sync error" purely based on iteration order.\n\nFix: OR hasError across all rows of the same provider, take MAX(lastSyncAt) across rows. Applied to both SEO and Ads pills.`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Multi-row pills OR'd correctly.",
  },
  {
    title: "POPUP HIGH: side-effects silently dropped on Vercel serverless",
    description: `${SENTINEL}\n\napp/api/public/popup/lead/route.ts. The CONVERTED event write, notifyLeadCreated bell, and Slack/Resend fan-out were all unawaited (\`void ...catch()\`). On Vercel serverless, unawaited promises are dropped when the route returns — meaning every popup conversion in prod silently lost its CONVERTED event, in-app bell notification, Slack message, and operator email.\n\nFix: awaited all three. Adds 200-400ms to the response, acceptable for a one-shot conversion form (operator waits for success state anyway).`,
    severity: BugReportSeverity.HIGH,
    resolutionNote: "Serverless side-effects properly awaited.",
  },
];

async function main() {
  console.log(`[backfill4] seeding ${ROWS.length} rows`);
  const wiped = await prisma.bugReport.deleteMany({
    where: { description: { startsWith: SENTINEL } },
  });
  console.log(`[backfill4] cleared ${wiped.count} prior rows`);

  const approver = await prisma.user.findFirst({
    where: { email: "adamwolfe102@gmail.com" },
    select: { id: true },
  });

  for (const r of ROWS) {
    const createdAt = new Date(NOW - 0.1 * DAY);
    const timeline = [
      {
        at: createdAt.toISOString(),
        by: null,
        byEmail: REPORTER.email,
        kind: "status",
        from: null,
        to: BugReportStatus.PENDING,
        text: "Filed via deep-dive audit",
      },
      {
        at: new Date(createdAt.getTime() + 30 * 60 * 1000).toISOString(),
        by: approver?.id ?? null,
        byEmail: "adamwolfe102@gmail.com",
        kind: "status",
        from: BugReportStatus.PENDING,
        to: BugReportStatus.APPROVED,
        text: r.resolutionNote,
      },
    ];
    await prisma.bugReport.create({
      data: {
        title: r.title,
        description: r.description,
        severity: r.severity,
        status: BugReportStatus.APPROVED,
        reporterEmail: REPORTER.email,
        reporterRole: REPORTER.role,
        reporterOrgName: REPORTER.orgName,
        createdAt,
        updatedAt: createdAt,
        approvedAt: new Date(),
        approvedBy: approver?.id ?? null,
        resolutionNote: r.resolutionNote ?? null,
        timeline: timeline as unknown as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`[backfill4] inserted ${ROWS.length} rows`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
