// Generate an all-time ClientReport — the earliest tracked activity for an
// org through now, instead of the usual rolling 7d/28d window. Persists as
// a draft, exactly like createReport() (lib/actions/reports.ts): nothing
// here ever auto-shares, an operator still has to review it and flip it to
// "shared" from /portal/reports/<id> before the /r/<token> link goes live.
//
// DO NOT run this against prod — Adam runs it after this ships.
//
//   pnpm exec tsx --env-file=.env.local scripts/generate-alltime-report.ts --org <slug>
//   pnpm exec tsx --env-file=.env.local scripts/generate-alltime-report.ts --org <slug> --property <slug>
//   pnpm exec tsx --env-file=.env.local scripts/generate-alltime-report.ts --org <slug> --dry-run
//
// --dry-run generates the snapshot and prints headline numbers WITHOUT
// writing a ClientReport row.

import { getPrisma } from "../lib/db";
import { generateReportSnapshot } from "../lib/reports/generate";
import { generateShareToken } from "../lib/reports/token";

// Prisma 7 + Neon adapter: bare `new PrismaClient()` no longer works —
// route through the canonical adapter-backed client (same fix as
// scripts/backfill-lead-lease-links.ts).
const prisma = getPrisma();

const DRY_RUN = process.argv.includes("--dry-run");
const orgFlag = process.argv.indexOf("--org");
const ORG_SLUG = orgFlag > -1 ? process.argv[orgFlag + 1] : null;
const propertyFlag = process.argv.indexOf("--property");
const PROPERTY_SLUG = propertyFlag > -1 ? process.argv[propertyFlag + 1] : null;

async function main() {
  if (!ORG_SLUG) {
    throw new Error("Usage: --org <slug> is required (optionally --property <slug>, --dry-run)");
  }

  // Org.slug is @unique in the schema, so this can never actually return
  // more than one row — findMany + a length check is the defensive version
  // requested rather than trusting the constraint from inside a one-off
  // script.
  const orgs = await prisma.organization.findMany({
    where: { slug: ORG_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (orgs.length === 0) throw new Error(`No org matches slug "${ORG_SLUG}"`);
  if (orgs.length > 1) {
    throw new Error(
      `Slug "${ORG_SLUG}" matches ${orgs.length} orgs — refusing to guess which one.`,
    );
  }
  const org = orgs[0];

  let propertyId: string | null = null;
  if (PROPERTY_SLUG) {
    const property = await prisma.property.findFirst({
      where: { orgId: org.id, slug: PROPERTY_SLUG },
      select: { id: true, name: true },
    });
    if (!property) {
      throw new Error(`No property matches slug "${PROPERTY_SLUG}" in org "${org.name}"`);
    }
    propertyId = property.id;
    console.log(`Property: ${property.name} (${propertyId})`);
  }
  console.log(`Org: ${org.name} (${org.id})`);

  // All-time period: earliest tracked activity for the ORG (not narrowed to
  // --property — a property-scoped snapshot still reports on the full
  // history of the portfolio's tracking, same as how a "monthly" report's
  // window is calendar-derived rather than re-computed per property).
  const [earliestLead, earliestVisitorSession, earliestChatbot, earliestPopupEvent, earliestApplication] =
    await Promise.all([
      prisma.lead.findFirst({
        where: { orgId: org.id },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.visitorSession.findFirst({
        where: { orgId: org.id },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.chatbotEngagement.findFirst({
        where: { orgId: org.id },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.popupEvent.findFirst({
        where: { orgId: org.id },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true },
      }),
      prisma.application.findFirst({
        where: { property: { orgId: org.id } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

  const candidates = [
    earliestLead?.createdAt,
    earliestVisitorSession?.createdAt,
    earliestChatbot?.createdAt,
    earliestPopupEvent?.occurredAt,
    earliestApplication?.createdAt,
  ].filter((d): d is Date => d != null);

  const now = new Date();
  // No tracked data anywhere yet — fall back to a 1-day window so the
  // generator still gets a valid, non-empty period instead of dividing by
  // zero downstream.
  const periodStart =
    candidates.length > 0
      ? candidates.reduce((earliest, d) => (d < earliest ? d : earliest))
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const periodEnd = now;

  console.log(
    `All-time period: ${periodStart.toISOString()} -> ${periodEnd.toISOString()} ` +
      `(${candidates.length}/5 sources had data)`,
  );

  console.log("\nGenerating snapshot via generateReportSnapshot() (AI analysis enabled)...");
  const snapshot = await generateReportSnapshot(org.id, "custom", {
    propertyId,
    period: { periodStart, periodEnd },
  });

  console.log(
    `  KPIs: leads=${snapshot.kpis.leads} applications=${snapshot.kpis.applications} ` +
      `tours=${snapshot.kpis.tours} identifiedVisitors=${snapshot.kpis.identifiedVisitors ?? 0}`,
  );
  if (snapshot.popupStats) {
    console.log(
      `  Popups: shown=${snapshot.popupStats.shown} converted=${snapshot.popupStats.converted}`,
    );
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: not persisting.");
    return;
  }

  // Persist exactly like createReport() (lib/actions/reports.ts): draft
  // status, fresh shareToken, no auto-share. generatedBy is nullable
  // (Prisma schema: `generatedBy String?`, no FK — rows outlive user
  // deletes) — this run has no acting user, so null is the honest value
  // rather than inventing a fake user id.
  const report = await prisma.clientReport.create({
    data: {
      orgId: org.id,
      propertyId,
      kind: "custom",
      periodStart,
      periodEnd,
      snapshot: snapshot as object as never,
      shareToken: generateShareToken(),
      status: "draft",
      generatedBy: null,
    },
    select: { id: true, shareToken: true },
  });

  console.log("\nDraft report created.");
  console.log(`  Report id:   ${report.id}`);
  console.log(`  Portal path: /portal/reports/${report.id}`);
  console.log(`  Share path:  /r/${report.shareToken}  (inactive until an operator shares it)`);
}

main()
  .catch((err) => {
    console.error("generate-alltime-report failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
