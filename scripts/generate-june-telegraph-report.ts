// Env is loaded via a preload BEFORE this module graph (prisma binds
// DATABASE_URL at import time, and ESM imports are hoisted above any code
// here). Run with:
//   DOTENV_CONFIG_PATH=.env.production.local \
//     node -r dotenv/config --import tsx scripts/generate-june-telegraph-report.ts
import { prisma } from "../lib/db";
import { generateReportSnapshot } from "../lib/reports/generate";
import { generateShareToken } from "../lib/reports/token";

// ---------------------------------------------------------------------------
// One-off: generate the June 2026 Telegraph Commons client report for
// SG Real Estate and mint a public /r/<token> share link.
//
// Uses the real, workspace-saved report generator (generateReportSnapshot)
// with an explicit calendar-month period override (Jun 1 – Jul 1, exclusive)
// scoped to the Telegraph Commons property. Idempotent: re-running reuses the
// existing shared report instead of minting a second link.
// ---------------------------------------------------------------------------

const ORG_ID = "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate
const PROPERTY_ID = "cmo402dzi0003c93lq9i6xz6h"; // Telegraph Commons (flagship)
const PERIOD_START = new Date("2026-06-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-07-01T00:00:00.000Z"); // exclusive
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://leasestack.co").replace(/\/+$/, "");

const HEADLINE = "Telegraph Commons — June 2026 Marketing & Leasing Performance";
const NOTES =
  "Your June performance across attribution, applications, and identified visitor traffic, pulled live from AppFolio, Google, and the LeaseStack pixel. Every figure reflects real activity for the month.";

async function main() {
  // 1. Verify the org + property are the ones we expect before writing.
  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true, name: true },
  });
  const property = await prisma.property.findUnique({
    where: { id: PROPERTY_ID },
    select: { id: true, name: true, orgId: true },
  });

  if (!org) throw new Error(`Org ${ORG_ID} not found`);
  if (!property) throw new Error(`Property ${PROPERTY_ID} not found`);
  if (property.orgId !== org.id) {
    throw new Error(`Property ${property.name} does not belong to org ${org.name}`);
  }
  console.log(`Org:      ${org.name} (${org.id})`);
  console.log(`Property: ${property.name} (${property.id})`);
  console.log(`Period:   ${PERIOD_START.toISOString()} → ${PERIOD_END.toISOString()} (exclusive)`);

  // 2. Idempotency — reuse an already-shared June report if one exists.
  const existing = await prisma.clientReport.findFirst({
    where: {
      orgId: ORG_ID,
      propertyId: PROPERTY_ID,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "shared",
    },
    select: { id: true, shareToken: true },
  });
  if (existing) {
    console.log("\nExisting shared June report found — reusing its link:");
    console.log(`\n  ${APP_URL}/r/${existing.shareToken}\n`);
    return;
  }

  // 3. Generate the real snapshot via the workspace generator.
  console.log("\nGenerating snapshot via generateReportSnapshot()…");
  const snapshot = await generateReportSnapshot(ORG_ID, "monthly", {
    propertyId: PROPERTY_ID,
    period: { periodStart: PERIOD_START, periodEnd: PERIOD_END },
  });
  console.log(
    `  KPIs: leads=${snapshot.kpis.leads} applications=${snapshot.kpis.applications} ` +
      `identifiedVisitors=${snapshot.kpis.identifiedVisitors ?? 0} tours=${snapshot.kpis.tours}`,
  );

  // 4. Persist as a shared ClientReport with a public share token.
  const shareToken = generateShareToken();
  const report = await prisma.clientReport.create({
    data: {
      orgId: ORG_ID,
      propertyId: PROPERTY_ID,
      kind: "monthly",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      snapshot: snapshot as object as never,
      headline: HEADLINE,
      notes: NOTES,
      shareToken,
      status: "shared",
      sharedAt: new Date(),
    },
    select: { id: true, shareToken: true },
  });

  console.log("\n✅ Shared report created.");
  console.log(`   Report id: ${report.id}`);
  console.log(`\n   Public link:  ${APP_URL}/r/${report.shareToken}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
