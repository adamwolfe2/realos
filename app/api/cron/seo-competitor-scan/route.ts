import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import {
  findNearbyCompetitors,
  isGooglePlacesConfigured,
} from "@/lib/seo/google-places";
import { CompetitorScanSource } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Per-property scan is ~1-2s. 200 properties worst case ≈ 7 minutes.
// Vercel Pro ceiling is 300s, so we self-cap at 50 properties per run
// and rotate through them daily — see `BATCH_SIZE` below.
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/seo-competitor-scan
//
// Daily 03:00 UTC. For every LIVE property with geocoded coordinates,
// queries Google Places "Nearby Search (New)" for up to 15 apartment_
// complex / lodging properties within 1 mile, and writes the results
// to PropertyCompetitorScan. The SEO Agent's CONTENT_GAP +
// COMPETITOR_AMENITY_GAP rules read from this table.
//
// Auth: Bearer CRON_SECRET (verifyCronAuth shared helper).
// Cost: ~$0.017 per property per run. 50 properties × 30 days = $25/mo
// at the global level (not per-tenant — Google Places usage caps at the
// platform billing account).
//
// Rotation: BATCH_SIZE caps each run at 50 properties so we stay under
// the 5-minute function timeout even with API latency spikes. A
// `nextScanAt` field on the Property tracks last attempt, ensuring we
// circle through the whole portfolio over multiple days.
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;
const SCAN_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days minimum between scans per property

export async function GET(req: NextRequest) {
  const authResponse = verifyCronAuth(req);
  if (authResponse) return authResponse;

  const startedAt = Date.now();

  if (!isGooglePlacesConfigured()) {
    return recordCronRun("seo-competitor-scan", async () => ({
      result: NextResponse.json({
        ok: true,
        skipped: true,
        reason: "GOOGLE_PLACES_API_KEY missing",
      }),
      recordsProcessed: 0,
    }));
  }

  return recordCronRun("seo-competitor-scan", async () => {
  // Pick the next batch — properties that are LIVE, have geo coordinates,
  // and haven't been scanned in the last SCAN_INTERVAL_MS. Order by
  // lastSyncedAt nulls-first so brand-new properties get scanned soonest.
  const cutoff = new Date(Date.now() - SCAN_INTERVAL_MS);
  const candidates = await prisma.property.findMany({
    where: {
      lifecycle: "ACTIVE",
      launchStatus: "LIVE",
      latitude: { not: null },
      longitude: { not: null },
      OR: [
        { competitorScans: { none: {} } },
        {
          competitorScans: {
            every: { scannedAt: { lt: cutoff } },
          },
        },
      ],
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      latitude: true,
      longitude: true,
    },
    take: BATCH_SIZE,
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
  });

  const stats = {
    propertiesScanned: 0,
    competitorsWritten: 0,
    errors: [] as Array<{ propertyId: string; error: string }>,
  };

  for (const property of candidates) {
    if (property.latitude == null || property.longitude == null) continue;

    const result = await findNearbyCompetitors({
      latitude: property.latitude,
      longitude: property.longitude,
      radiusMeters: 1609,
      maxResults: 15,
    });

    if (!("ok" in result) || !result.ok) {
      const error = "error" in result ? result.error : "skipped";
      stats.errors.push({ propertyId: property.id, error });
      continue;
    }

    stats.propertiesScanned += 1;

    // Upsert each competitor row keyed by (propertyId, source, placeId).
    // Sequential to keep DB pressure low; the API latency dominates anyway.
    for (const c of result.competitors) {
      try {
        await prisma.propertyCompetitorScan.upsert({
          where: {
            propertyId_source_externalId: {
              propertyId: property.id,
              source: CompetitorScanSource.GOOGLE_PLACES_NEARBY,
              externalId: c.placeId,
            },
          },
          create: {
            orgId: property.orgId,
            propertyId: property.id,
            source: CompetitorScanSource.GOOGLE_PLACES_NEARBY,
            externalId: c.placeId,
            competitorName: c.displayName,
            competitorUrl: c.websiteUri ?? c.googleMapsUri,
            competitorAddress: c.formattedAddress,
            distanceMeters: c.distanceMeters,
            rating: c.rating,
            reviewCount: c.reviewCount,
            amenities: c.types,
            rawPayload: JSON.parse(JSON.stringify(c)),
            scannedAt: new Date(),
          },
          update: {
            competitorName: c.displayName,
            competitorUrl: c.websiteUri ?? c.googleMapsUri,
            competitorAddress: c.formattedAddress,
            distanceMeters: c.distanceMeters,
            rating: c.rating,
            reviewCount: c.reviewCount,
            amenities: c.types,
            rawPayload: JSON.parse(JSON.stringify(c)),
            scannedAt: new Date(),
          },
        });
        stats.competitorsWritten += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "DB write failed";
        stats.errors.push({
          propertyId: property.id,
          error: `upsert ${c.placeId}: ${message}`,
        });
      }
    }
  }

    const durationMs = Date.now() - startedAt;

    return {
      result: NextResponse.json({
        ok: true,
        candidates: candidates.length,
        propertiesScanned: stats.propertiesScanned,
        competitorsWritten: stats.competitorsWritten,
        errors: stats.errors.slice(0, 20),
        durationMs,
      }),
      recordsProcessed: stats.competitorsWritten,
    };
  });
}
