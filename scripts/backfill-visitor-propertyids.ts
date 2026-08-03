// Backfill Visitor.propertyId for single-ACTIVE-property orgs.
//
// Context (2026-08-02 SG focus): all of SG's 277 Visitor rows predate
// property stamping at pixel ingest, so their propertyId is null and the
// report's "identified visitors" count was only circumstantially true.
// Ingest now stamps (webhook via integration binding/URL inference,
// segment sync via the sole-ACTIVE-property rule); this script brings the
// historical rows up to the same standard.
//
// Rule (shared with lib/properties/sole-active.ts): an org with EXACTLY
// ONE ACTIVE property can only have been showing that property's site to
// its pixel — stamping is provable. Orgs with 0 or 2+ ACTIVE properties
// are skipped and logged; we never guess.
//
// Additive + idempotent: only touches rows where propertyId IS NULL, so
// re-runs are no-ops and rows stamped by ingest are never re-filed.
//
// Safety: bare invocation is ALWAYS a dry run — prints per-org counts and
// writes nothing. The resolved DB host prints before any query runs so a
// wrong .env.local is visible before anything is touched.
//
//   pnpm exec tsx --env-file=.env.local scripts/backfill-visitor-propertyids.ts           (dry run)
//   pnpm exec tsx --env-file=.env.local scripts/backfill-visitor-propertyids.ts --write   (persists)

import { getPrisma } from "../lib/db";
import { soleActiveProperty } from "../lib/properties/sole-active";

async function main() {
  const write = process.argv.includes("--write");

  const dbUrl = process.env.DATABASE_URL ?? "";
  let host = "(unparseable DATABASE_URL)";
  try {
    host = new URL(dbUrl).host;
  } catch {
    // keep placeholder
  }
  console.log(`DB host: ${host}`);
  console.log(write ? "MODE: --write (persisting)" : "MODE: dry run (no writes)");

  // Prisma 7 + Neon adapter: bare `new PrismaClient()` no longer works —
  // route through the canonical adapter-backed client. Constructed AFTER
  // the host print so a missing DATABASE_URL fails after the preflight
  // output, not before it.
  const prisma = getPrisma();

  const orgsWithNulls = await prisma.visitor.groupBy({
    by: ["orgId"],
    where: { propertyId: null },
    _count: { _all: true },
  });

  if (orgsWithNulls.length === 0) {
    console.log("No Visitor rows with null propertyId anywhere. Done.");
    return;
  }

  let stamped = 0;
  let skippedOrgs = 0;

  for (const group of orgsWithNulls) {
    const { orgId } = group;
    const nullCount = group._count._all;

    const [org, sole] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, slug: true },
      }),
      soleActiveProperty(orgId),
    ]);
    const label = `${org?.name ?? "?"} (${org?.slug ?? orgId})`;

    if (!sole) {
      skippedOrgs += 1;
      console.log(
        `SKIP  ${label}: ${nullCount} unstamped visitors, 0 or 2+ ACTIVE properties — cannot attribute safely`,
      );
      continue;
    }

    const target = sole;
    if (write) {
      const res = await prisma.visitor.updateMany({
        where: { orgId, propertyId: null },
        data: { propertyId: target.id },
      });
      stamped += res.count;
      console.log(
        `STAMP ${label}: ${res.count} visitors -> ${target.name} (${target.id})`,
      );
    } else {
      stamped += nullCount;
      console.log(
        `WOULD STAMP ${label}: ${nullCount} visitors -> ${target.name} (${target.id})`,
      );
    }
  }

  console.log(
    `\n${write ? "Stamped" : "Would stamp"} ${stamped} visitors; skipped ${skippedOrgs} org(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Disconnect only if a client was actually created — when main()
    // failed on a missing DATABASE_URL there is nothing to disconnect
    // and getPrisma() would just throw again.
    if ((globalThis as { prisma?: unknown }).prisma) {
      void getPrisma().$disconnect();
    }
  });
