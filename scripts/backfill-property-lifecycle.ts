/**
 * scripts/backfill-property-lifecycle.ts
 *
 * One-shot reclassifier for the Property table after the lifecycle
 * migration. The migration's SQL backfill caught the obvious sub-record
 * patterns; this script runs the canonical TypeScript classifier
 * (lib/properties/marketable.ts:classifyProperty) which has slightly
 * richer rules and stays in lockstep with the import-time classifier.
 *
 * SAFE TO RE-RUN. Skips any row whose lifecycle was last set by
 * lifecycleSetBy=OPERATOR — those are sticky, never overwrite.
 *
 * Usage:
 *   set -a; source .env.local; set +a; \
 *     pnpm exec tsx scripts/backfill-property-lifecycle.ts \
 *     [--org=<slug>] [--dry-run]
 *
 * Defaults to all orgs. Use --org=sg-real-estate to scope.
 *
 * --dry-run prints what would change without writing.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";
import { classifyProperty } from "../lib/properties/marketable";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set. Source .env.local first.");

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
});

const orgSlug = process.argv.find((a) => a.startsWith("--org="))?.split("=")[1];
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(
    `[backfill-lifecycle] starting${orgSlug ? ` for org="${orgSlug}"` : " for ALL orgs"}${dryRun ? " (DRY RUN)" : ""}`,
  );

  const orgFilter = orgSlug
    ? { org: { slug: orgSlug } }
    : {};

  // Only reclassify rows the auto-classifier owns. Operator decisions
  // are sticky.
  const rows = await prisma.property.findMany({
    where: {
      lifecycleSetBy: "AUTO_CLASSIFIER",
      ...orgFilter,
    },
    select: {
      id: true,
      name: true,
      totalUnits: true,
      addressLine1: true,
      lifecycle: true,
      excludeReason: true,
      org: { select: { slug: true, name: true } },
    },
  });

  console.log(`[backfill-lifecycle] found ${rows.length} candidate rows`);

  const stats = {
    unchanged: 0,
    promoted: 0, // EXCLUDED → IMPORTED or ACTIVE
    demoted: 0, // IMPORTED/ACTIVE → EXCLUDED
    flippedToImported: 0, // ACTIVE → IMPORTED (rare; classifier no longer sure)
  };

  // Group by org for readable output
  const byOrg = new Map<string, typeof rows>();
  for (const row of rows) {
    const slug = row.org.slug;
    if (!byOrg.has(slug)) byOrg.set(slug, []);
    byOrg.get(slug)!.push(row);
  }

  for (const [slug, orgRows] of byOrg) {
    const orgName = orgRows[0]?.org.name ?? slug;
    console.log(`\n--- ${orgName} (${slug}) — ${orgRows.length} rows ---`);

    let orgChanged = 0;
    for (const row of orgRows) {
      const next = classifyProperty({
        name: row.name,
        totalUnits: row.totalUnits,
        addressLine1: row.addressLine1,
      });

      if (next.lifecycle === row.lifecycle) {
        stats.unchanged++;
        continue;
      }

      orgChanged++;

      if (next.lifecycle === "EXCLUDED") stats.demoted++;
      else if (row.lifecycle === "EXCLUDED") stats.promoted++;
      else if (next.lifecycle === "IMPORTED") stats.flippedToImported++;

      console.log(
        `  ${row.lifecycle} → ${next.lifecycle}: "${row.name}"${next.reason ? ` (${next.reason})` : ""}`,
      );

      if (!dryRun) {
        await prisma.property.update({
          where: { id: row.id },
          data: {
            lifecycle: next.lifecycle,
            lifecycleSetAt: new Date(),
            excludeReason: next.reason,
          },
        });
      }
    }

    console.log(`  → ${orgChanged} would change`);
  }

  console.log("\n--- summary ---");
  console.log(`  unchanged:                 ${stats.unchanged}`);
  console.log(`  promoted (EXCLUDED → ...): ${stats.promoted}`);
  console.log(`  demoted (... → EXCLUDED):  ${stats.demoted}`);
  console.log(`  ACTIVE → IMPORTED:         ${stats.flippedToImported}`);

  // Final state summary so the operator can sanity-check counts.
  console.log("\n--- final state by org ---");
  const finals = await prisma.property.groupBy({
    by: ["orgId", "lifecycle"],
    _count: { _all: true },
    where: orgSlug ? { org: { slug: orgSlug } } : {},
  });
  const orgNames = await prisma.organization.findMany({
    where: { id: { in: finals.map((f) => f.orgId) } },
    select: { id: true, name: true, slug: true },
  });
  const nameById = new Map(orgNames.map((o) => [o.id, `${o.name} (${o.slug})`]));
  const grouped = new Map<string, Record<string, number>>();
  for (const f of finals) {
    const label = nameById.get(f.orgId) ?? f.orgId;
    if (!grouped.has(label)) grouped.set(label, {});
    grouped.get(label)![f.lifecycle] = f._count._all;
  }
  for (const [label, counts] of grouped) {
    console.log(
      `  ${label}: ACTIVE=${counts.ACTIVE ?? 0} IMPORTED=${counts.IMPORTED ?? 0} EXCLUDED=${counts.EXCLUDED ?? 0} ARCHIVED=${counts.ARCHIVED ?? 0}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[backfill-lifecycle] failed:", err);
  process.exit(1);
});
