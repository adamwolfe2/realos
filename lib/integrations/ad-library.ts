import "server-only";
import { prisma } from "@/lib/db";
import type { AdLibrarySearchKind, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Meta Ad Library — public ad-tracking via Meta's open Ad Library API.
//
// graph.facebook.com/v19.0/ads_archive returns every active + recently-
// inactive ad for a given Page or search term. No customer credentials
// required — we use an agency-level Meta App access token (stored in
// META_AD_LIBRARY_TOKEN env var). One token serves every tenant.
//
// Important caveat: Meta only exposes impressions + spend RANGES for
// political/issue/social ads (governed by the FEC-equivalent rules).
// Commercial ads return creative + status + dates only. The schema in
// prisma/schema.prisma is permissive — fields default to null.
//
// Docs: https://www.facebook.com/ads/library/api/
// ---------------------------------------------------------------------------

const API_VERSION = "v19.0";
const ENDPOINT = `https://graph.facebook.com/${API_VERSION}/ads_archive`;

const FIELDS = [
  "id",
  "ad_creation_time",
  "ad_creative_bodies",
  "ad_creative_link_captions",
  "ad_creative_link_titles",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "currency",
  "impressions",
  "spend",
  "publisher_platforms",
  "page_id",
  "page_name",
].join(",");

type AdLibraryRawAd = {
  id?: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_snapshot_url?: string;
  currency?: string;
  impressions?: { lower_bound?: string; upper_bound?: string };
  spend?: { lower_bound?: string; upper_bound?: string };
  publisher_platforms?: string[];
  page_id?: string;
  page_name?: string;
};

export type ScanResult = {
  ok: boolean;
  found: number;
  newCount: number;
  inactiveCount: number;
  error?: string;
};

function getToken(): string | null {
  return process.env.META_AD_LIBRARY_TOKEN ?? null;
}

export function adLibraryConfigured(): boolean {
  return !!getToken();
}

// Build the API URL. Meta requires `ad_reached_countries` (an array literal)
// and an `ad_active_status` filter. We pull both ACTIVE and ALL so we get
// recently-stopped ads too — those are useful for "1 ad went dark this week".
function buildUrl(args: {
  searchKind: AdLibrarySearchKind;
  searchValue: string;
  countries: string[];
}): string {
  const params = new URLSearchParams();
  params.set("access_token", getToken() ?? "");
  params.set("fields", FIELDS);
  params.set("limit", "50");
  params.set("ad_active_status", "ALL");
  params.set("ad_type", "ALL");
  params.set(
    "ad_reached_countries",
    `["${args.countries.map((c) => c.toUpperCase()).join('","')}"]`,
  );
  if (args.searchKind === "PAGE_ID") {
    params.set("search_page_ids", `["${args.searchValue}"]`);
  } else {
    params.set("search_terms", args.searchValue);
  }
  return `${ENDPOINT}?${params.toString()}`;
}

// Try to extract a Facebook Page ID or search term out of whatever the
// operator pasted. Accepts:
//   - bare page name ("Telegraph Commons")
//   - facebook.com URL (https://www.facebook.com/telegraphcommons/...)
//   - facebook.com/profile.php?id=12345
//   - raw numeric page id
export function parseAdvertiserInput(raw: string): {
  searchKind: AdLibrarySearchKind;
  searchValue: string;
  displayName: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Input is empty.");
  // Numeric → page id
  if (/^\d{6,}$/.test(trimmed)) {
    return {
      searchKind: "PAGE_ID",
      searchValue: trimmed,
      displayName: `Page ${trimmed}`,
    };
  }
  // facebook.com URL
  if (/facebook\.com/i.test(trimmed)) {
    try {
      const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
      const pageIdParam = u.searchParams.get("id");
      if (pageIdParam && /^\d{6,}$/.test(pageIdParam)) {
        return {
          searchKind: "PAGE_ID",
          searchValue: pageIdParam,
          displayName: `Page ${pageIdParam}`,
        };
      }
      // Path slug → use as search term. Real Page ID resolution requires
      // a separate /pages/lookup call; for the demo, search_terms works.
      const slug = u.pathname.split("/").filter(Boolean)[0];
      if (slug && slug !== "profile.php") {
        const display = slug.replace(/[-_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return {
          searchKind: "SEARCH_TERM",
          searchValue: display,
          displayName: display,
        };
      }
    } catch {
      // fall through
    }
  }
  // Bare term
  return {
    searchKind: "SEARCH_TERM",
    searchValue: trimmed,
    displayName: trimmed,
  };
}

export async function fetchAdsForAdvertiser(args: {
  searchKind: AdLibrarySearchKind;
  searchValue: string;
  countries?: string[];
}): Promise<{ ok: true; ads: AdLibraryRawAd[] } | { ok: false; error: string }> {
  if (!adLibraryConfigured()) {
    return {
      ok: false,
      error:
        "Meta Ad Library token not configured. Set META_AD_LIBRARY_TOKEN.",
    };
  }
  try {
    const url = buildUrl({
      searchKind: args.searchKind,
      searchValue: args.searchValue,
      countries: args.countries ?? ["US"],
    });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Meta API ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`,
      };
    }
    const json = (await response.json()) as { data?: AdLibraryRawAd[] };
    return { ok: true, ads: Array.isArray(json.data) ? json.data : [] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

// Map a raw API ad into the Prisma create payload shape.
function mapAdToCreate(
  raw: AdLibraryRawAd,
): Omit<Prisma.AdLibraryAdCreateInput, "advertiser"> | null {
  if (!raw.id) return null;
  const status = raw.ad_delivery_stop_time ? "INACTIVE" : "ACTIVE";

  // Pluck the first body / title / caption — most ads only ever ship one.
  // Operators can drill into ad_snapshot_url for the full creative.
  const creativeBody = raw.ad_creative_bodies?.[0] ?? null;
  const creativeTitle = raw.ad_creative_link_titles?.[0] ?? null;
  const linkUrl = raw.ad_creative_link_captions?.[0] ?? null;

  // Impressions / spend ranges are strings like "1000-4999". Parse to ints.
  const parseRange = (
    s?: { lower_bound?: string; upper_bound?: string },
  ): { low: number | null; high: number | null } => {
    if (!s) return { low: null, high: null };
    const low = s.lower_bound ? Number(s.lower_bound) : null;
    const high = s.upper_bound ? Number(s.upper_bound) : null;
    return {
      low: low != null && Number.isFinite(low) ? low : null,
      high: high != null && Number.isFinite(high) ? high : null,
    };
  };
  const impr = parseRange(raw.impressions);
  const spend = parseRange(raw.spend);

  return {
    externalId: raw.id,
    status,
    creativeBody,
    creativeTitle,
    linkUrl,
    impressionsLow: impr.low,
    impressionsHigh: impr.high,
    spendLow: spend.low != null ? Math.round(spend.low * 100) : null,
    spendHigh: spend.high != null ? Math.round(spend.high * 100) : null,
    currency: raw.currency ?? null,
    publisherPlatforms: raw.publisher_platforms ?? [],
    adCreationTime: raw.ad_creation_time
      ? new Date(raw.ad_creation_time)
      : null,
    adDeliveryStart: raw.ad_delivery_start_time
      ? new Date(raw.ad_delivery_start_time)
      : null,
    adDeliveryStop: raw.ad_delivery_stop_time
      ? new Date(raw.ad_delivery_stop_time)
      : null,
    raw: raw as unknown as Prisma.InputJsonValue,
  };
}

// Run a single scan for an advertiser: fetch the latest ads from Meta,
// upsert them into our DB, and update lastScannedAt. Returns counts so
// the UI can show "3 new, 1 went inactive".
export async function scanAdvertiser(
  advertiserId: string,
): Promise<ScanResult> {
  const advertiser = await prisma.adLibraryAdvertiser.findUnique({
    where: { id: advertiserId },
  });
  if (!advertiser) return { ok: false, found: 0, newCount: 0, inactiveCount: 0, error: "Advertiser not found" };

  const result = await fetchAdsForAdvertiser({
    searchKind: advertiser.searchKind,
    searchValue: advertiser.searchValue,
  });

  if (!result.ok) {
    await prisma.adLibraryAdvertiser.update({
      where: { id: advertiserId },
      data: { lastScannedAt: new Date(), lastScanError: result.error },
    });
    return {
      ok: false,
      found: 0,
      newCount: 0,
      inactiveCount: 0,
      error: result.error,
    };
  }

  const existing = await prisma.adLibraryAd.findMany({
    where: { advertiserId },
    select: { externalId: true, status: true },
  });
  const existingByExternal = new Map(existing.map((e) => [e.externalId, e]));

  let newCount = 0;
  let inactiveCount = 0;
  const now = new Date();

  for (const raw of result.ads) {
    const mapped = mapAdToCreate(raw);
    if (!mapped) continue;
    const prior = existingByExternal.get(mapped.externalId);
    if (!prior) newCount += 1;
    if (
      prior &&
      prior.status === "ACTIVE" &&
      mapped.status === "INACTIVE"
    ) {
      inactiveCount += 1;
    }
    await prisma.adLibraryAd.upsert({
      where: {
        advertiserId_externalId: {
          advertiserId,
          externalId: mapped.externalId,
        },
      },
      update: { ...mapped, lastSeenAt: now },
      create: { ...mapped, advertiserId },
    });
  }

  await prisma.adLibraryAdvertiser.update({
    where: { id: advertiserId },
    data: { lastScannedAt: now, lastScanError: null },
  });

  return {
    ok: true,
    found: result.ads.length,
    newCount,
    inactiveCount,
  };
}
