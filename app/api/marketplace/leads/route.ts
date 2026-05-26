import { NextRequest, NextResponse } from "next/server";
import { MarketplaceLeadPropertyType } from "@prisma/client";
import { listBrowseLeads, listMarketplaceMarkets } from "@/lib/marketplace/repo";

// ---------------------------------------------------------------------------
// GET /api/marketplace/leads
//
// Public browse endpoint. No auth required — this is the supply-side feed
// the public /marketplace page queries from the client. PII is masked at
// the repo layer (lib/marketplace/repo.ts).
//
// Query params (all optional):
//   market        — "All markets" or canonical market label
//   propertyType  — RENTAL | SALE | INVESTMENT | COMMERCIAL | ALL
//   minIntent     — 0..100, default 70
//   minPriceCents — number
//   maxPriceCents — number
//   page          — 1-indexed
//   pageSize      — capped to 60
//
// Response:
//   { leads: BrowseLead[], total, page, pageSize, hasMore, markets: string[] }
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

const PROPERTY_TYPES = new Set<string>([
  "RENTAL",
  "SALE",
  "INVESTMENT",
  "COMMERCIAL",
  "ALL",
]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const propertyTypeRaw = sp.get("propertyType");
  const propertyType =
    propertyTypeRaw && PROPERTY_TYPES.has(propertyTypeRaw)
      ? propertyTypeRaw === "ALL"
        ? "ALL"
        : (propertyTypeRaw as MarketplaceLeadPropertyType)
      : "ALL";

  const minIntent = parseIntOrUndef(sp.get("minIntent"));
  const minPriceCents = parseIntOrUndef(sp.get("minPriceCents"));
  const maxPriceCents = parseIntOrUndef(sp.get("maxPriceCents"));
  const page = parseIntOrUndef(sp.get("page"));
  const pageSize = parseIntOrUndef(sp.get("pageSize"));
  const market = sp.get("market") ?? undefined;

  try {
    const [result, markets] = await Promise.all([
      listBrowseLeads({
        market,
        propertyType,
        minIntent,
        minPriceCents,
        maxPriceCents,
        page,
        pageSize,
      }),
      listMarketplaceMarkets(),
    ]);

    return NextResponse.json(
      {
        ...result,
        markets,
      },
      {
        // Brief CDN cache — the marketplace updates on weekly cron + on
        // checkout. 30s gives a fast cache hit while still keeping the
        // feel "live" for browsers.
        headers: {
          "Cache-Control":
            "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("marketplace browse failed", err);
    return NextResponse.json(
      { error: "marketplace_unavailable" },
      { status: 500 },
    );
  }
}

function parseIntOrUndef(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}
