import "server-only";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/db";
import { maybeDecrypt } from "@/lib/crypto";
import {
  AppFolioIntegration,
  BackendPlatform,
  Prisma,
  Property,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// AppFolio integration.
//
// Two modes:
//   1. EMBED_SCRAPE (ported from github.com/adamwolfe2/telegraph-commons),
//      works today against https://{subdomain}.appfolio.com/listings for any
//      tenant, even without the Plus plan. Parses cheerio-loaded HTML.
//   2. REST (stubbed behind TODO). AppFolio Plus exposes a REST API but we
//      don't yet have Norman's credentials to confirm the payload shape,
//      so the PRD's /api/v1/listings URL structure is kept as a reference
//      and the code path is flagged.
//
// DECISION: defaults to EMBED_SCRAPE because it's proven to work. Tenants
// can opt into REST once we have a verified Plus client.
//
// TODO(Sprint 06 follow-up): confirm REST payload shape against Norman's
// account and flip the default for Plus tenants.
// ---------------------------------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (compatible; RealEstaite/1.0; +https://realestaite.co)";

export type AppFolioSyncMode = "EMBED_SCRAPE" | "REST";

export type NormalizedListing = {
  backendListingId: string;
  unitType?: string | null;
  unitNumber?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  priceCents?: number | null;
  isAvailable: boolean;
  availableFrom?: Date | null;
  photoUrls?: string[];
  description?: string | null;
  raw: Prisma.InputJsonValue;
};

// ---------------------------------------------------------------------------
// Mode 1, EMBED_SCRAPE, ported from telegraph-commons/src/lib/appfolio.ts
// ---------------------------------------------------------------------------

function parseRent(input: string): number | null {
  const match = input.trim().match(/\$?([\d,]+)/);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseSqft(input: string): number | null {
  const match = input.match(/(\d{2,5})/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parseBedBath(
  bedBath: string
): { bedrooms: number | null; bathrooms: number | null } {
  const bedMatch = bedBath.match(/(\d+(?:\.\d+)?)\s*bed/i);
  const bathMatch = bedBath.match(/(\d+(?:\.\d+)?)\s*bath/i);
  return {
    bedrooms: bedMatch ? Number(bedMatch[1]) : null,
    bathrooms: bathMatch ? Number(bathMatch[1]) : null,
  };
}

function parseAvailableDate(input: string): Date | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const [, m, d, y] = match;
  const year = y.length === 2 ? `20${y}` : y;
  const month = m.padStart(2, "0");
  const day = d.padStart(2, "0");
  const iso = `${year}-${month}-${day}T00:00:00.000Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function fetchEmbedScrape(
  integration: AppFolioIntegration,
  addressMatch?: string | null
): Promise<NormalizedListing[]> {
  if (!integration.instanceSubdomain) {
    throw new Error("AppFolio instanceSubdomain is required");
  }
  const url = `https://${integration.instanceSubdomain}.appfolio.com/listings`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`AppFolio listings HTML returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const normalized: NormalizedListing[] = [];

  $(".listing-item.result.js-listing-item").each((_, el) => {
    const $card = $(el);
    const address = $card.find(".js-listing-address").text().trim();
    if (addressMatch && !address.includes(addressMatch)) return;

    const domId = $card.attr("id") ?? "";
    const id = domId.replace(/^listing_/, "");
    if (!id) return;

    const detailHref = $card.find(".js-link-to-detail").attr("href");
    const applyHref = $card.find(".js-listing-apply").attr("href");

    let uid = "";
    if (applyHref) {
      const uidMatch = applyHref.match(/listable_uid=([a-f0-9-]+)/i);
      if (uidMatch) uid = uidMatch[1];
    }
    if (!uid && detailHref) {
      const uidMatch = detailHref.match(/detail\/([a-f0-9-]+)/i);
      if (uidMatch) uid = uidMatch[1];
    }

    const rentRaw = $card.find(".js-listing-blurb-rent").first().text();
    const rentDollars = parseRent(rentRaw);
    const bedBath = $card
      .find(".js-listing-blurb-bed-bath")
      .first()
      .text()
      .trim()
      .replace(/\s+/g, " ");
    const { bedrooms, bathrooms } = parseBedBath(bedBath);

    let sqft: number | null = null;
    $card.find(".detail-box__item").each((_, item) => {
      const label = $(item).find(".detail-box__label").text().toLowerCase();
      if (label.includes("square feet")) {
        sqft = parseSqft($(item).find(".detail-box__value").text());
      }
    });
    if (sqft === null) {
      sqft = parseSqft($card.find(".js-listing-square-feet").text());
    }

    const availRaw = $card.find(".js-listing-available").first().text().trim();
    const availableFrom = parseAvailableDate(availRaw);

    const title = $card
      .find(".js-listing-title")
      .text()
      .trim()
      .replace(/\s+/g, " ");
    const description = $card
      .find(".js-listing-description")
      .text()
      .trim()
      .replace(/\s+/g, " ");

    const photoSet = new Set<string>();
    const primaryPhoto =
      $card.find(".js-listing-image").attr("data-original") ??
      $card.find(".js-listing-image").attr("src");
    if (primaryPhoto) photoSet.add(primaryPhoto);

    normalized.push({
      backendListingId: uid || id,
      unitType: title || null,
      unitNumber: null,
      bedrooms,
      bathrooms,
      squareFeet: sqft,
      priceCents: rentDollars ? Math.round(rentDollars * 100) : null,
      isAvailable: true,
      availableFrom,
      photoUrls: Array.from(photoSet),
      description,
      raw: {
        source: "embed_scrape",
        appfolioId: id,
        uid,
        address,
        rentDisplay: rentRaw.trim(),
        availRaw,
        detailHref,
        applyHref,
      } as Prisma.InputJsonValue,
    });
  });

  return normalized;
}

// ---------------------------------------------------------------------------
// Mode 2, REST (Plus plan). Stubbed; re-enable once we have a verified
// Plus client to confirm the payload shape.
// ---------------------------------------------------------------------------

async function fetchRest(
  integration: AppFolioIntegration
): Promise<NormalizedListing[]> {
  const apiKey = maybeDecrypt(integration.apiKeyEncrypted ?? null);
  if (!apiKey) {
    throw new Error(
      "AppFolio REST mode requires an encrypted apiKey. Store one or switch the integration to EMBED_SCRAPE (embed fallback)."
    );
  }

  const params = new URLSearchParams();
  if (integration.propertyGroupFilter) {
    params.set("property_group", integration.propertyGroupFilter);
  }
  const url = `https://${integration.instanceSubdomain}.appfolio.com/api/v1/listings${
    params.size ? `?${params.toString()}` : ""
  }`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`AppFolio REST returned ${response.status}`);
  }

  // TODO(Sprint 06 follow-up): the REST payload shape needs confirmation
  // against Norman's account; this is a reasonable guess until we see real
  // data. Keep `raw` as the full payload so we can back-fill fields later.
  const body = (await response.json()) as {
    listings?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
  };
  const rows = body.listings ?? body.data ?? [];

  return rows.map((row) => ({
    backendListingId:
      String(row.id ?? row.listing_id ?? row.uid ?? ""),
    unitType: (row.unit_type as string) ?? null,
    unitNumber: (row.unit_number as string) ?? null,
    bedrooms:
      typeof row.bedrooms === "number" ? row.bedrooms : parseBedBath(String(row.bed_bath ?? "")).bedrooms,
    bathrooms:
      typeof row.bathrooms === "number" ? row.bathrooms : parseBedBath(String(row.bed_bath ?? "")).bathrooms,
    squareFeet:
      typeof row.square_feet === "number"
        ? row.square_feet
        : parseSqft(String(row.square_feet ?? "")),
    priceCents:
      typeof row.rent === "number" ? Math.round(row.rent * 100) : null,
    isAvailable:
      row.available === undefined ? true : Boolean(row.available),
    availableFrom: row.available_from
      ? new Date(String(row.available_from))
      : null,
    photoUrls: Array.isArray(row.photos)
      ? (row.photos as string[])
      : [],
    description: (row.description as string) ?? null,
    raw: { source: "rest", ...row } as Prisma.InputJsonValue,
  }));
}

// ---------------------------------------------------------------------------
// Top-level sync. Fetches, matches listings to Property rows by
// `backendPropertyGroup` (case-insensitive), upserts, and refreshes
// Property denorm fields (priceMin, priceMax, availableCount,
// lastSyncedAt).
// ---------------------------------------------------------------------------

export type SyncOutcome = {
  synced: number;
  matchedProperties: number;
  skippedUnknownProperty: number;
  error: string | null;
};

export async function syncListingsForOrg(
  orgId: string,
  options: { force?: boolean } = {}
): Promise<SyncOutcome> {
  const integration = await prisma.appFolioIntegration.findUnique({
    where: { orgId },
  });
  if (!integration) {
    return {
      synced: 0,
      matchedProperties: 0,
      skippedUnknownProperty: 0,
      error: "No AppFolio integration configured",
    };
  }
  if (!options.force && integration.syncStatus === "syncing") {
    return {
      synced: 0,
      matchedProperties: 0,
      skippedUnknownProperty: 0,
      error: "Sync already in progress",
    };
  }

  await prisma.appFolioIntegration.update({
    where: { orgId },
    data: { syncStatus: "syncing", lastError: null },
  });

  const properties = await prisma.property.findMany({
    where: { orgId, backendPlatform: BackendPlatform.APPFOLIO },
  });

  try {
    const mode: AppFolioSyncMode = integration.useEmbedFallback
      ? "EMBED_SCRAPE"
      : integration.apiKeyEncrypted
      ? "REST"
      : "EMBED_SCRAPE";

    let remoteListings: NormalizedListing[];
    if (mode === "REST") {
      remoteListings = await fetchRest(integration);
    } else {
      // If the tenant only manages one property, scope the scrape by its
      // street address to avoid sucking in listings from sibling buildings.
      const addressMatch =
        properties.length === 1 ? properties[0].addressLine1 ?? null : null;
      remoteListings = await fetchEmbedScrape(integration, addressMatch);
    }

    const propertyByGroup = new Map<string, Property>();
    for (const p of properties) {
      if (p.backendPropertyGroup) {
        propertyByGroup.set(p.backendPropertyGroup.toLowerCase(), p);
      }
    }

    let synced = 0;
    let skipped = 0;
    const matchedSet = new Set<string>();

    for (const rl of remoteListings) {
      const fallbackProperty = properties[0];
      // TODO(Sprint 06): richer property matching once AppFolio payload
      // exposes property_group reliably in embed-scrape mode. For now we
      // assume everything from the scrape lives under the first property,
      // which matches Telegraph Commons' reality (single building).
      const property = fallbackProperty;
      if (!property) {
        skipped++;
        continue;
      }

      await prisma.listing.upsert({
        where: {
          propertyId_backendListingId: {
            propertyId: property.id,
            backendListingId: rl.backendListingId,
          },
        },
        create: {
          propertyId: property.id,
          backendListingId: rl.backendListingId,
          unitType: rl.unitType ?? null,
          unitNumber: rl.unitNumber ?? null,
          bedrooms: rl.bedrooms ?? null,
          bathrooms: rl.bathrooms ?? null,
          squareFeet: rl.squareFeet ?? null,
          priceCents: rl.priceCents ?? null,
          isAvailable: rl.isAvailable,
          availableFrom: rl.availableFrom ?? null,
          photoUrls: rl.photoUrls
            ? (rl.photoUrls as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          description: rl.description ?? null,
          raw: rl.raw,
          lastSyncedAt: new Date(),
        },
        update: {
          unitType: rl.unitType ?? null,
          unitNumber: rl.unitNumber ?? null,
          bedrooms: rl.bedrooms ?? null,
          bathrooms: rl.bathrooms ?? null,
          squareFeet: rl.squareFeet ?? null,
          priceCents: rl.priceCents ?? null,
          isAvailable: rl.isAvailable,
          availableFrom: rl.availableFrom ?? null,
          photoUrls: rl.photoUrls
            ? (rl.photoUrls as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          description: rl.description ?? null,
          raw: rl.raw,
          lastSyncedAt: new Date(),
        },
      });
      matchedSet.add(property.id);
      synced++;
    }

    // Refresh Property denormalized fields.
    for (const p of properties) {
      const agg = await prisma.listing.aggregate({
        where: { propertyId: p.id, isAvailable: true },
        _min: { priceCents: true },
        _max: { priceCents: true },
        _count: { _all: true },
      });
      await prisma.property.update({
        where: { id: p.id },
        data: {
          priceMin: agg._min.priceCents ?? null,
          priceMax: agg._max.priceCents ?? null,
          availableCount: agg._count._all,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
    }

    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: {
        syncStatus: "idle",
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    return {
      synced,
      matchedProperties: matchedSet.size,
      skippedUnknownProperty: skipped,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: { syncStatus: "error", lastError: message },
    });
    for (const p of properties) {
      await prisma.property.update({
        where: { id: p.id },
        data: { syncError: message },
      });
    }
    return {
      synced: 0,
      matchedProperties: 0,
      skippedUnknownProperty: 0,
      error: message,
    };
  }
}
