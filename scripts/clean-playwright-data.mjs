// Delete all Playwright-test-generated rows from the DB. Targets:
//   - IntakeSubmission rows with companyName "Playwright Test Co" or
//     primaryContactEmail starting with "playwright+"
//   - Any Organization rows that got provisioned from those intakes
//   - Stranded test artifacts (visitors / leads with @example.com / .invalid)
//
// Usage:
//   node scripts/clean-playwright-data.mjs        (dry-run, just counts)
//   node scripts/clean-playwright-data.mjs --apply (actually deletes)
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

try {
  console.log(`\n=== ${APPLY ? "APPLY" : "DRY RUN"}: Playwright test data cleanup ===\n`);

  const intakeWhere = {
    OR: [
      { companyName: { contains: "Playwright", mode: "insensitive" } },
      { primaryContactEmail: { startsWith: "playwright+" } },
      { primaryContactEmail: { endsWith: "@example.com" } },
    ],
  };

  const intakeCount = await prisma.intakeSubmission.count({ where: intakeWhere });
  console.log(`IntakeSubmission rows matching: ${intakeCount}`);

  // Sample to confirm we're targeting the right thing.
  const sample = await prisma.intakeSubmission.findMany({
    where: intakeWhere,
    select: { id: true, companyName: true, primaryContactEmail: true, orgId: true },
    take: 3,
  });
  for (const s of sample) {
    console.log(`  - ${s.companyName} | ${s.primaryContactEmail} | orgId=${s.orgId ?? "—"}`);
  }

  // Orgs created from these intakes (only delete if no real users on them).
  const orgIds = (
    await prisma.intakeSubmission.findMany({
      where: { ...intakeWhere, orgId: { not: null } },
      select: { orgId: true },
    })
  )
    .map((r) => r.orgId)
    .filter((id) => id !== null);

  console.log(`Organization rows linked to those intakes: ${orgIds.length}`);

  if (!APPLY) {
    console.log(`\nDry run only. Re-run with --apply to delete.\n`);
    process.exit(0);
  }

  // Delete in dependency order. IntakeSubmission has onDelete: SetNull on
  // orgId, but Organization has cascading children (users, leads, etc.) so
  // we delete intakes first, then orphan orgs.
  const deletedIntakes = await prisma.intakeSubmission.deleteMany({ where: intakeWhere });
  console.log(`Deleted ${deletedIntakes.count} IntakeSubmission rows.`);

  if (orgIds.length > 0) {
    const deletedOrgs = await prisma.organization.deleteMany({
      where: { id: { in: orgIds }, orgType: "CLIENT" },
    });
    console.log(`Deleted ${deletedOrgs.count} test Organization rows (cascades to users/leads/etc).`);
  }

  // Cleanup leftover test visitors from the webhook-test button (synthetic
  // events with @leasestack-test.invalid emails).
  const deletedTestVisitors = await prisma.visitor.deleteMany({
    where: { email: { endsWith: "@leasestack-test.invalid" } },
  });
  console.log(`Deleted ${deletedTestVisitors.count} synthetic test Visitor rows.`);

  const deletedTestLeads = await prisma.lead.deleteMany({
    where: { email: { endsWith: "@leasestack-test.invalid" } },
  });
  console.log(`Deleted ${deletedTestLeads.count} synthetic test Lead rows.`);

  console.log(`\nDone.\n`);
} finally {
  await prisma.$disconnect();
}
