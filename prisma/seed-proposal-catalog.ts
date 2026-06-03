// ---------------------------------------------------------------------------
// Standalone seed for the proposal builder catalog.
//
// Usage:
//   tsx prisma/seed-proposal-catalog.ts
//   pnpm tsx prisma/seed-proposal-catalog.ts
//   node --env-file-if-exists=.env.local --import tsx prisma/seed-proposal-catalog.ts
//
// Idempotent. Safe to run on a populated database — `ensureCatalogSeeded()`
// upserts by slug so pricing or copy edits in `lib/proposals/catalog.ts`
// propagate without duplicating rows.
//
// Style mirrors `prisma/seed.ts`: explicit DATABASE_URL guard, Neon HTTP
// adapter for the one-shot script (no need for the WebSocket Pool here —
// only upserts, no transactions), and a non-zero exit on failure so CI
// surfaces problems instead of silently passing.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";
import { PROPOSAL_CATALOG } from "../lib/proposals/catalog";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaNeonHttp(
  connectionString,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

async function main() {
  let upserted = 0;
  for (const item of PROPOSAL_CATALOG) {
    await prisma.proposalCatalogItem.upsert({
      where: { slug: item.slug },
      update: {
        kind: item.kind,
        label: item.label,
        description: item.description,
        defaultPriceCents: item.defaultPriceCents,
        cadence: item.cadence,
        stripePriceIdMonthly: item.stripePriceIdMonthly,
        stripePriceIdAnnual: item.stripePriceIdAnnual,
        active: item.active,
        sortOrder: item.sortOrder,
      },
      create: {
        slug: item.slug,
        kind: item.kind,
        label: item.label,
        description: item.description,
        defaultPriceCents: item.defaultPriceCents,
        cadence: item.cadence,
        stripePriceIdMonthly: item.stripePriceIdMonthly,
        stripePriceIdAnnual: item.stripePriceIdAnnual,
        active: item.active,
        sortOrder: item.sortOrder,
      },
    });
    upserted += 1;
  }

  const total = await prisma.proposalCatalogItem.count();
  // eslint-disable-next-line no-console -- seed script intentionally prints
  console.log(
    `Proposal catalog seeded: ${upserted} upserts, ${total} rows total.`,
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console -- seed script intentionally prints
    console.error("Proposal catalog seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
