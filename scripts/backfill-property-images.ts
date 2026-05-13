/**
 * scripts/backfill-property-images.ts
 *
 * One-shot maintenance: fill in missing Property.heroImageUrl /
 * Property.photoUrls / Property.logoUrl by:
 *
 *   1. AppFolio backfill — for every ACTIVE Property with no heroImageUrl,
 *      pick the first Listing (by createdAt asc) that has a non-empty
 *      photoUrls array, and copy:
 *        - heroImageUrl  ← listing.photoUrls[0]
 *        - photoUrls     ← dedupe(union(all listing photoUrls for the
 *                                       property))
 *   2. Website scrape — for everything STILL without a heroImageUrl that
 *      has a websiteUrl, sequentially call refreshPropertyImagesFromWebsite
 *      so we hit external origins one at a time.
 *
 * PRODUCTION SAFETY
 * -----------------
 * Backfilling images is non-destructive (we only fill NULL slots, never
 * overwrite operator-set hero/logo), so this script IS allowed to run
 * against production. But defense in depth: an --orgId arg is REQUIRED so
 * the operator must consciously scope to a single tenant. Mirrors the
 * triple-guard layout from scripts/seed-telegraph-commons.ts but drops the
 * ALLOW_DEMO_SEED gate, which is specific to fake-data seeders.
 *
 * Usage
 * -----
 *   set -a; source .env.local; set +a; \
 *     pnpm exec tsx scripts/backfill-property-images.ts \
 *       --orgId=<orgId> [--scrape-only] [--appfolio-only] [--dry-run]
 *
 * Flags:
 *   --orgId=<id>      REQUIRED. Organization.id to scope the backfill to.
 *   --scrape-only     Skip the AppFolio pass, only run the website scrape.
 *   --appfolio-only   Skip the website scrape, only run the AppFolio pass.
 *   --dry-run         Read-only: log what would change, write nothing.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";
import { refreshPropertyImagesFromWebsite } from "../lib/property-images/refresh";

// -----------------------------------------------------------------------------
// CLI parsing
// -----------------------------------------------------------------------------

const argv = process.argv.slice(2);

function flagValue(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}

function flagPresent(name: string): boolean {
  return argv.includes(`--${name}`);
}

const orgId = flagValue("orgId");
const scrapeOnly = flagPresent("scrape-only");
const appfolioOnly = flagPresent("appfolio-only");
const dryRun = flagPresent("dry-run");

if (!orgId) {
  throw new Error(
    "[backfill-property-images] --orgId=<orgId> is required. Refusing to run unscoped.",
  );
}
if (scrapeOnly && appfolioOnly) {
  throw new Error(
    "[backfill-property-images] --scrape-only and --appfolio-only are mutually exclusive.",
  );
}

// -----------------------------------------------------------------------------
// Prisma setup (Neon HTTP adapter — matches the other backfill/seed scripts)
// -----------------------------------------------------------------------------

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Source .env.local first.");
}

const adapter = new PrismaNeonHttp(
  connectionString,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Listing.photoUrls is a Json column — in practice an array of strings, but
 * we treat it defensively. Returns a cleaned, deduped list of HTTP(S) URLs.
 */
function parsePhotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (!/^https?:\/\//i.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Pass 1 — AppFolio backfill
// -----------------------------------------------------------------------------

type AppFolioStats = {
  candidates: number;
  filled: number;
  noListingPhotos: number;
};

async function backfillFromAppFolio(): Promise<AppFolioStats> {
  console.log(
    `\n[appfolio] scanning ACTIVE properties with heroImageUrl=NULL (orgId=${orgId})…`,
  );

  const properties = await prisma.property.findMany({
    where: {
      orgId,
      lifecycle: "ACTIVE",
      heroImageUrl: null,
    },
    select: {
      id: true,
      name: true,
      listings: {
        select: {
          id: true,
          photoUrls: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const stats: AppFolioStats = {
    candidates: properties.length,
    filled: 0,
    noListingPhotos: 0,
  };

  console.log(`[appfolio] ${stats.candidates} candidate properties`);

  for (const p of properties) {
    // Gather all listing photos for this property (deduped, in listing
    // createdAt order) and pick the hero from the first listing that has
    // any photos at all.
    const allPhotos: string[] = [];
    const seen = new Set<string>();
    let firstListingWithPhotos: string | null = null;

    for (const listing of p.listings) {
      const urls = parsePhotoUrls(listing.photoUrls);
      if (urls.length === 0) continue;
      if (!firstListingWithPhotos) firstListingWithPhotos = urls[0] ?? null;
      for (const u of urls) {
        if (seen.has(u)) continue;
        seen.add(u);
        allPhotos.push(u);
      }
    }

    if (!firstListingWithPhotos) {
      stats.noListingPhotos++;
      continue;
    }

    console.log(
      `  fill "${p.name}" (${p.id}): hero=${firstListingWithPhotos.slice(0, 80)} (+${allPhotos.length - 1} more)`,
    );

    if (!dryRun) {
      await prisma.property.update({
        where: { id: p.id },
        data: {
          heroImageUrl: firstListingWithPhotos,
          photoUrls: allPhotos,
        },
      });
    }
    stats.filled++;
  }

  console.log(
    `[appfolio] filled ${stats.filled} / ${stats.candidates} (${stats.noListingPhotos} had no listing photos)`,
  );
  return stats;
}

// -----------------------------------------------------------------------------
// Pass 2 — Website scrape (sequential)
// -----------------------------------------------------------------------------

type ScrapeStats = {
  candidates: number;
  heroSet: number;
  logoSet: number;
  failed: number;
};

async function backfillFromWebsite(): Promise<ScrapeStats> {
  console.log(
    `\n[scrape] scanning properties still missing heroImageUrl with a websiteUrl (orgId=${orgId})…`,
  );

  const properties = await prisma.property.findMany({
    where: {
      orgId,
      lifecycle: "ACTIVE",
      heroImageUrl: null,
      websiteUrl: { not: null },
    },
    select: { id: true, name: true, websiteUrl: true },
  });

  const stats: ScrapeStats = {
    candidates: properties.length,
    heroSet: 0,
    logoSet: 0,
    failed: 0,
  };

  console.log(`[scrape] ${stats.candidates} candidate properties`);

  // Sequential — don't hammer external origins.
  for (const p of properties) {
    console.log(`  scrape "${p.name}" (${p.id}) ← ${p.websiteUrl}`);
    if (dryRun) continue;

    try {
      const r = await refreshPropertyImagesFromWebsite({ propertyId: p.id });
      if (r.heroSet) stats.heroSet++;
      if (r.logoSet) stats.logoSet++;
      if (r.error) {
        stats.failed++;
        console.log(`    warn: ${r.error}`);
      }
    } catch (err) {
      stats.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    error: ${msg}`);
    }
  }

  console.log(
    `[scrape] heroSet=${stats.heroSet} logoSet=${stats.logoSet} failed=${stats.failed}`,
  );
  return stats;
}

// -----------------------------------------------------------------------------
// Final tally
// -----------------------------------------------------------------------------

async function reportRemaining(): Promise<number> {
  const remaining = await prisma.property.count({
    where: {
      orgId,
      lifecycle: "ACTIVE",
      heroImageUrl: null,
    },
  });
  return remaining;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log(
    `[backfill-property-images] orgId=${orgId} scrapeOnly=${scrapeOnly} appfolioOnly=${appfolioOnly} dryRun=${dryRun}`,
  );

  // Sanity-check the org exists before we start; the operator may have
  // typo'd the id and we'd silently update zero rows otherwise.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });
  if (!org) {
    throw new Error(
      `[backfill-property-images] Organization id=${orgId} not found. Aborting.`,
    );
  }
  console.log(`[backfill-property-images] org: ${org.name} (${org.slug})`);

  const appfolio = appfolioOnly || !scrapeOnly
    ? await backfillFromAppFolio()
    : null;
  const scrape = scrapeOnly || !appfolioOnly
    ? await backfillFromWebsite()
    : null;

  const remaining = await reportRemaining();

  console.log(`\n--- summary (orgId=${orgId}) ---`);
  if (appfolio) {
    console.log(
      `  AppFolio backfill:  filled=${appfolio.filled}   candidates=${appfolio.candidates}   noListingPhotos=${appfolio.noListingPhotos}`,
    );
  } else {
    console.log(`  AppFolio backfill:  skipped`);
  }
  if (scrape) {
    console.log(
      `  Website scrape:     heroSet=${scrape.heroSet}   logoSet=${scrape.logoSet}   failed=${scrape.failed}   candidates=${scrape.candidates}`,
    );
  } else {
    console.log(`  Website scrape:     skipped`);
  }
  console.log(
    `  Remaining ACTIVE properties with heroImageUrl=NULL: ${remaining}${dryRun ? " (dry-run; nothing was written)" : ""}`,
  );
}

main()
  .catch((err) => {
    console.error("[backfill-property-images] failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
