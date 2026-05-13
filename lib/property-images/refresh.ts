import "server-only";
import { prisma } from "@/lib/db";
import { scrapePropertyImages, normaliseUrl } from "./scrape";

// ---------------------------------------------------------------------------
// refreshPropertyImagesFromWebsite — single-entry helper used by both the
// on-demand server action and the nightly cron. Encapsulates the
// "scrape → only-fill-empty → write timestamp" rules so the policy lives
// in one place.
//
// Policy:
//   - heroImageUrl: only overwritten when it's currently NULL. Operators
//     who upload a hero shouldn't have it clobbered by the next scrape.
//   - logoUrl: same — operator upload wins.
//   - If the operator explicitly requests a re-scrape via the UI, callers
//     pass `force: true` and we overwrite.
//   - imageScrapeAt is ALWAYS updated, even on failure, so the cron
//     doesn't re-attempt the same broken site every run.
//   - imageScrapeError is cleared on success, set on failure.
// ---------------------------------------------------------------------------

export type RefreshResult = {
  propertyId: string;
  heroSet: boolean;
  logoSet: boolean;
  websiteUrl: string;
  error: string | null;
};

export async function refreshPropertyImagesFromWebsite(args: {
  propertyId: string;
  /** Override the URL we'll scrape. Defaults to the row's websiteUrl. */
  websiteUrl?: string;
  /** Overwrite existing heroImageUrl / logoUrl even when already set. */
  force?: boolean;
}): Promise<RefreshResult> {
  const { propertyId, force } = args;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      websiteUrl: true,
      heroImageUrl: true,
      logoUrl: true,
    },
  });
  if (!property) {
    return {
      propertyId,
      heroSet: false,
      logoSet: false,
      websiteUrl: "",
      error: "Property not found",
    };
  }

  const url = args.websiteUrl ?? property.websiteUrl;
  if (!url) {
    return {
      propertyId,
      heroSet: false,
      logoSet: false,
      websiteUrl: "",
      error: "No websiteUrl on property — set one or pass a URL override.",
    };
  }
  const normalised = normaliseUrl(url);
  if (!normalised) {
    return {
      propertyId,
      heroSet: false,
      logoSet: false,
      websiteUrl: url,
      error: "Invalid URL",
    };
  }

  try {
    const result = await scrapePropertyImages(normalised);

    const shouldSetHero =
      result.heroImageUrl && (force || !property.heroImageUrl);
    const shouldSetLogo =
      result.logoUrl && (force || !property.logoUrl);

    await prisma.property.update({
      where: { id: propertyId },
      data: {
        websiteUrl: normalised,
        heroImageUrl: shouldSetHero ? result.heroImageUrl : undefined,
        logoUrl: shouldSetLogo ? result.logoUrl : undefined,
        imageScrapeAt: new Date(),
        imageScrapeError: result.warning,
      },
    });

    return {
      propertyId,
      heroSet: Boolean(shouldSetHero),
      logoSet: Boolean(shouldSetLogo),
      websiteUrl: normalised,
      error: result.warning,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Update timestamp + error so the cron doesn't loop on this URL.
    await prisma.property
      .update({
        where: { id: propertyId },
        data: {
          websiteUrl: normalised,
          imageScrapeAt: new Date(),
          imageScrapeError: message.slice(0, 500),
        },
      })
      .catch(() => null);
    return {
      propertyId,
      heroSet: false,
      logoSet: false,
      websiteUrl: normalised,
      error: message,
    };
  }
}

/**
 * Batch — used by the nightly cron and the AppFolio backfill. Sequential
 * (NOT parallel) so we don't burst external origins. ~6s per row at the
 * scraper timeout, so 50 properties takes <5 min worst-case.
 */
export async function batchRefreshPropertyImages(args: {
  propertyIds: string[];
  force?: boolean;
}): Promise<RefreshResult[]> {
  const results: RefreshResult[] = [];
  for (const propertyId of args.propertyIds) {
    const r = await refreshPropertyImagesFromWebsite({
      propertyId,
      force: args.force,
    });
    results.push(r);
  }
  return results;
}
