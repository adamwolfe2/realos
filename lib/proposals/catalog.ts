import "server-only";

import type { ProposalCatalogItem } from "@prisma/client";

import { prisma } from "@/lib/db";
import { PROPOSAL_CATALOG } from "@/lib/proposals/catalog-data";

export { PROPOSAL_CATALOG } from "@/lib/proposals/catalog-data";
export type { ProposalCatalogSeed } from "@/lib/proposals/catalog-data";

/**
 * Idempotently upsert the canonical proposal catalog rows by `slug`. Safe to
 * run on every app boot — no-ops when rows already match. Pricing edits in
 * the constant above are propagated on next run; the `active` flag is the
 * lever for hiding a SKU without deleting historical references.
 *
 * Returns the number of rows that were inserted or updated so callers can
 * log the result.
 */
export async function ensureCatalogSeeded(): Promise<{
  upserted: number;
  total: number;
}> {
  // review-fix: parallelize. The prior sequential `for await` did N
  // round-trips to Postgres on every invocation. At 18 SKUs and ~30ms
  // round-trip on Neon, that's ~540ms of cold-start latency every time
  // this runs (and the doc-string explicitly says "safe to run on app
  // startup"). Promise.all fans the upserts out so the wall-clock floor
  // is one round-trip plus the slowest individual write.
  const results = await Promise.all(
    PROPOSAL_CATALOG.map((item) =>
      prisma.proposalCatalogItem.upsert({
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
      }),
    ),
  );
  return { upserted: results.length, total: PROPOSAL_CATALOG.length };
}

/**
 * Return all active catalog rows ordered for the builder picker: TIER first,
 * then ADDON, ordered by `sortOrder`. Inactive rows are excluded so a
 * deprecated SKU disappears from the picker without a destructive delete.
 */
export async function getCatalog(): Promise<ProposalCatalogItem[]> {
  return prisma.proposalCatalogItem.findMany({
    where: { active: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
  });
}

/**
 * Fetch a single catalog row by slug. Returns null on miss so callers can
 * decide how to handle a stale reference (e.g. a saved line item that
 * pointed at a now-deleted SKU).
 */
export async function getCatalogItemBySlug(
  slug: string,
): Promise<ProposalCatalogItem | null> {
  return prisma.proposalCatalogItem.findUnique({ where: { slug } });
}
