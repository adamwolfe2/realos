import "server-only";

import { prisma } from "@/lib/db";
import {
  MarketplaceLeadPropertyType,
  MarketplaceLeadStatus,
  MarketplaceSyncSourceKind,
  type MarketplaceSeller,
  type MarketplaceSyncSource,
} from "@prisma/client";
import { scoreLead, type RawIntentPayload } from "@/lib/marketplace/scoring";
import { runSourceReplenish } from "@/lib/marketplace/cursive-sync";

// ---------------------------------------------------------------------------
// Seller ingest — two paths for sellers to add leads to the marketplace
//
//   1. ingestCsvLeads(seller, rows)
//      Direct upload from the seller dashboard. Each row has the basic
//      fields (firstName, email, etc.) plus optional intent overrides.
//      We score on the fly using whatever payload fields the row carries
//      and create one MarketplaceSyncSource (kind = MANUAL) per seller
//      to scope their imports.
//
//   2. ingestSellerCursiveSegment(seller, segmentId, config)
//      Reuses the existing CURSIVE replenish pipeline but stamps each
//      ingested lead with this seller's id. Creates a MarketplaceSyncSource
//      with kind = CURSIVE_AUDIENCE if one doesn't already exist for this
//      (seller, segmentId) pair.
// ---------------------------------------------------------------------------

const STALENESS_MS = 14 * 24 * 60 * 60 * 1000;

export type CsvRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  propertyType?: MarketplaceLeadPropertyType;
  budgetMinCents?: number;
  budgetMaxCents?: number;
  budgetUnit?: "ABS" | "MONTHLY";
  signal?: string;
  timeline?: string;
  // Behavioural overlays — optional
  listingsViewed7d?: number;
  hasMortgagePreApp?: boolean;
  hasScheduledTour?: boolean;
  hasCashBuyerSignal?: boolean;
  isRelocating?: boolean;
  isDistressed?: boolean;
};

export type CsvIngestSummary = {
  fetched: number;
  upserted: number;
  expired: number;
  skipped: number;
  errors: string[];
};

// Get-or-create the "manual" source that holds this seller's CSV uploads.
async function getOrCreateSellerManualSource(
  seller: MarketplaceSeller,
): Promise<MarketplaceSyncSource> {
  const externalId = `seller:${seller.id}:manual`;
  const existing = await prisma.marketplaceSyncSource.findFirst({
    where: { kind: MarketplaceSyncSourceKind.MANUAL, externalId },
  });
  if (existing) return existing;
  return prisma.marketplaceSyncSource.create({
    data: {
      name: `Seller ${seller.email} · CSV uploads`,
      kind: MarketplaceSyncSourceKind.MANUAL,
      externalId,
      defaultPropertyType: MarketplaceLeadPropertyType.SALE,
      defaultMarket: "United States",
      minScoreFloor: 40,
      baselineScore: 60,
      defaultPriceCents: 5000,
      enabled: true,
    },
  });
}

export async function ingestCsvLeads(
  seller: MarketplaceSeller,
  rows: CsvRow[],
): Promise<CsvIngestSummary> {
  const source = await getOrCreateSellerManualSource(seller);
  const summary: CsvIngestSummary = {
    fetched: rows.length,
    upserted: 0,
    expired: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.email && !row.phone) {
        summary.skipped += 1;
        continue;
      }
      // Synthesise a stable profile id from email|phone hash so re-imports
      // dedupe. This is "good enough" — sellers shouldn't be importing the
      // same lead repeatedly in a single session.
      const idSeed = (row.email ?? row.phone ?? `row-${i}`).toLowerCase();
      const profileId = `seller-csv:${seller.id}:${hash32(idSeed)}`;

      const payload: RawIntentPayload = {
        profileId,
        email: row.email,
        phone: row.phone,
        firstName: row.firstName,
        lastName: row.lastName,
        city: row.city,
        state: row.state?.toUpperCase(),
        postalCode: row.postalCode,
        listingsViewed7d: row.listingsViewed7d,
        hasMortgagePreApp: row.hasMortgagePreApp,
        hasScheduledTour: row.hasScheduledTour,
        hasCashBuyerSignal: row.hasCashBuyerSignal,
        isRelocating: row.isRelocating,
        isDistressed: row.isDistressed,
        budgetMinCents: row.budgetMinCents,
        budgetMaxCents: row.budgetMaxCents,
        budgetUnit: row.budgetUnit,
        emailVerified: !!row.email,
        phoneVerified: !!row.phone,
        addressVerified: !!row.postalCode,
        // Treat freshly uploaded leads as "just seen" so recency
        // contributes max points to the score.
        lastSeenAt: new Date().toISOString(),
      };
      const outcome = scoreLead(payload);
      const intentScore = Math.max(outcome.intentScore, source.baselineScore);
      const tieredPrice = tierPrice(source.defaultPriceCents, intentScore);
      const passesFloor = intentScore >= source.minScoreFloor;
      const expiresAt = new Date(Date.now() + STALENESS_MS);
      const market = (row.city && row.city.length > 2 ? row.city : null) ??
        row.state ?? source.defaultMarket ?? "Unspecified";

      await prisma.marketplaceLead.upsert({
        where: {
          sourceId_cursiveProfileId: {
            sourceId: source.id,
            cursiveProfileId: profileId,
          },
        },
        create: {
          sourceId: source.id,
          sellerId: seller.id,
          cursiveProfileId: profileId,
          firstName: row.firstName ?? null,
          lastName: row.lastName ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
          photoUrl: photoFor(profileId),
          city: row.city ?? null,
          state: row.state?.toUpperCase() ?? null,
          postalCode: row.postalCode ?? null,
          market,
          propertyType: row.propertyType ?? source.defaultPropertyType,
          intentScore,
          budgetLabel: outcome.budgetLabel,
          budgetMinCents: row.budgetMinCents ?? null,
          budgetMaxCents: row.budgetMaxCents ?? null,
          signal: row.signal ?? outcome.signal,
          timeline: row.timeline ?? outcome.timeline,
          intentPayload: payload as object,
          priceCents: tieredPrice,
          status: passesFloor
            ? MarketplaceLeadStatus.AVAILABLE
            : MarketplaceLeadStatus.EXPIRED,
          expiresAt,
        },
        update: {
          sellerId: seller.id,
          firstName: row.firstName ?? null,
          lastName: row.lastName ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
          city: row.city ?? null,
          state: row.state?.toUpperCase() ?? null,
          postalCode: row.postalCode ?? null,
          market,
          propertyType: row.propertyType ?? source.defaultPropertyType,
          intentScore,
          budgetLabel: outcome.budgetLabel,
          budgetMinCents: row.budgetMinCents ?? null,
          budgetMaxCents: row.budgetMaxCents ?? null,
          signal: row.signal ?? outcome.signal,
          timeline: row.timeline ?? outcome.timeline,
          intentPayload: payload as object,
          priceCents: tieredPrice,
          lastEnrichedAt: new Date(),
          expiresAt,
        },
      });

      if (passesFloor) summary.upserted += 1;
      else summary.expired += 1;
    } catch (err) {
      summary.errors.push(
        `Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Update seller counters.
  await prisma.marketplaceSeller.update({
    where: { id: seller.id },
    data: {
      totalLeadsContributed: {
        increment: summary.upserted,
      },
    },
  });

  return summary;
}

// Wire a Cursive segment to this seller. The replenish pipeline does the
// heavy lifting — we just create the source row with sellerId stamped.
// (Note: source-level sellerId requires a small post-process to backfill
// every lead's sellerId after a replenish run; we run it inline below.)
export async function ingestSellerCursiveSegment(
  seller: MarketplaceSeller,
  config: {
    name: string;
    segmentId: string;
    kind: "CURSIVE_AUDIENCE" | "CURSIVE_SEGMENT";
    defaultPropertyType: MarketplaceLeadPropertyType;
    defaultMarket?: string;
    minScoreFloor?: number;
    baselineScore?: number;
    defaultPriceCents?: number;
  },
) {
  // Check for an existing source for this (seller, segment).
  const existing = await prisma.marketplaceSyncSource.findFirst({
    where: {
      kind: config.kind,
      externalId: `seller:${seller.id}:${config.segmentId}`,
    },
  });
  const source =
    existing ??
    (await prisma.marketplaceSyncSource.create({
      data: {
        name: config.name,
        kind: config.kind,
        externalId: `seller:${seller.id}:${config.segmentId}`,
        defaultPropertyType: config.defaultPropertyType,
        defaultMarket: config.defaultMarket ?? "United States",
        minScoreFloor: config.minScoreFloor ?? 50,
        baselineScore: config.baselineScore ?? 70,
        defaultPriceCents: config.defaultPriceCents ?? 7500,
        cursiveApiKeyEnc: seller.cursiveApiKeyEnc ?? null,
        enabled: true,
      },
    }));

  // Decode the real Cursive id from the prefixed externalId and call the
  // existing replenish pipeline against it.
  const realSegmentId = config.segmentId;
  const sourceForReplenish: MarketplaceSyncSource = {
    ...source,
    externalId: realSegmentId,
  };
  const summary = await runSourceReplenish(sourceForReplenish);

  // Stamp every lead from this source with the seller's id.
  await prisma.marketplaceLead.updateMany({
    where: { sourceId: source.id, sellerId: null },
    data: { sellerId: seller.id },
  });
  // Increment seller contribution count.
  if (summary.newCount > 0) {
    await prisma.marketplaceSeller.update({
      where: { id: seller.id },
      data: {
        totalLeadsContributed: { increment: summary.newCount },
      },
    });
  }

  return { sourceId: source.id, summary };
}

// ---------------------------------------------------------------------------
// Helpers (mirrored from cursive-sync.ts so we don't have to export them)

function hash32(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h).toString(36);
}

function photoFor(profileId: string): string {
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = (h * 33) ^ profileId.charCodeAt(i);
  }
  const n = Math.abs(h) % 100;
  const gender = n % 2 === 0 ? "men" : "women";
  return `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
}

function tierPrice(basePriceCents: number, intentScore: number): number {
  let multiplier = 1.0;
  if (intentScore >= 90) multiplier = 2.0;
  else if (intentScore >= 80) multiplier = 1.5;
  else if (intentScore >= 70) multiplier = 1.2;
  else if (intentScore >= 60) multiplier = 1.0;
  else multiplier = 0.7;
  const cents = Math.round((basePriceCents * multiplier) / 500) * 500;
  return Math.max(500, cents);
}
