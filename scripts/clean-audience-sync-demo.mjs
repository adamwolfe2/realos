// Wipe all audience-related data for the Audience Sync Demo org so the
// dashboard is empty and ready for real AudienceLab segments.
//
// Run: pnpm tsx scripts/clean-audience-sync-demo.mjs
// Idempotent — safe to re-run. Does NOT delete the org itself.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const SLUG = "audience-sync-demo";

const org = await prisma.organization.findUnique({ where: { slug: SLUG } });
if (!org) {
  console.error(`No org with slug "${SLUG}" — nothing to clean.`);
  await prisma.$disconnect();
  process.exit(0);
}

// Order matters because of FK cascades, but Prisma will handle most of
// these on its own. Doing them explicitly for visibility.
const runs = await prisma.audienceSyncRun.deleteMany({ where: { orgId: org.id } });

// Schedules table only exists after the audience-sync-schedule migration
// has applied. Wrap in try/catch so re-runs against a stale DB don't fail.
let schedulesDeleted = 0;
try {
  const schedules = await prisma.audienceSyncSchedule.deleteMany({
    where: { orgId: org.id },
  });
  schedulesDeleted = schedules.count;
} catch (err) {
  console.warn(
    "Schedule table not available yet (migration not applied?). Skipping.",
    err instanceof Error ? err.message : err,
  );
}

const destinations = await prisma.audienceDestination.deleteMany({
  where: { orgId: org.id },
});
const segments = await prisma.audienceSegment.deleteMany({
  where: { orgId: org.id },
});

console.log("ok", {
  org: org.id,
  slug: org.slug,
  runsDeleted: runs.count,
  schedulesDeleted,
  destinationsDeleted: destinations.count,
  segmentsDeleted: segments.count,
});

await prisma.$disconnect();
