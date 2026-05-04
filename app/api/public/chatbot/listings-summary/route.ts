import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  chatbotConfigLimiter,
  checkRateLimit,
  getIp,
  rateLimited,
} from "@/lib/rate-limit";

// GET /api/public/chatbot/listings-summary?slug=<org-slug>
//
// Returns a compact live-inventory summary the embed widget uses to rewrite
// its greeting into something timely ("We just had rooms come available
// starting at $765/mo"). CORS-enabled, unauthenticated, same posture as
// /api/public/chatbot/config. If nothing is available the widget falls back
// to its static greeting.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(chatbotConfigLimiter, `ls:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60, { ...CORS_HEADERS });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json(
      { openCount: 0, lowestRent: null, nextAvailable: null },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      orgType: true,
      moduleChatbot: true,
      tenantSiteConfig: { select: { chatbotEnabled: true } },
      properties: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          slug: true,
          totalUnits: true,
          listings: {
            where: { isAvailable: true },
            select: {
              priceCents: true,
              availableFrom: true,
            },
          },
        },
      },
    },
  });

  if (
    !org ||
    org.orgType !== "CLIENT" ||
    !org.moduleChatbot ||
    !org.tenantSiteConfig?.chatbotEnabled
  ) {
    return NextResponse.json(
      { openCount: 0, lowestRent: null, nextAvailable: null },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // Scope to a single property when the embed slug matches a property slug
  // (multi-property org case). Without scoping, a tenant org with stale or
  // imported listings under sibling properties would pollute the greeting
  // (e.g. a $2/mo test record dragging lowestRent to garbage). When no slug
  // matches, fall back to all properties (single-property org case).
  const matchedProperty = org.properties.find((p) => p.slug === slug);
  const scopedProperties = matchedProperty
    ? [matchedProperty]
    : org.properties;

  // Only count listings that have a real rent set. AppFolio sync
  // populates priceCents=0 on vacant units without a rent roll entry;
  // those would inflate openCount and surface "$2/mo" as the floor.
  const allListings = scopedProperties.flatMap((p) => p.listings);
  const validListings = allListings.filter(
    (l) => typeof l.priceCents === "number" && (l.priceCents ?? 0) > 0,
  );

  // Cap openCount at the property's totalUnits — listings can drift
  // higher than physical units when the unit_directory report includes
  // historical bed-level rows that no longer represent open inventory.
  // For multi-property orgs, sum totalUnits across the scope.
  const totalUnitsCap = scopedProperties.reduce(
    (sum, p) => sum + (p.totalUnits ?? 0),
    0,
  );
  const rawOpen = validListings.length;
  const openCount =
    totalUnitsCap > 0 ? Math.min(rawOpen, totalUnitsCap) : rawOpen;

  // Defensive floor on rent: anything below $300/mo on a residential
  // listing is a junk record (test data, imported placeholder, missing
  // decimal). The previous $200 floor still let "$209" through and
  // surfaced as the chatbot greeting.
  const MIN_PLAUSIBLE_RENT_CENTS = 30_000;
  const rents = validListings
    .map((l) => l.priceCents)
    .filter(
      (c): c is number =>
        typeof c === "number" && c >= MIN_PLAUSIBLE_RENT_CENTS,
    );
  const lowestCents = rents.length ? Math.min(...rents) : null;
  const lowestRent = lowestCents
    ? Math.round(lowestCents / 100)
    : null;

  const futureDates = validListings
    .map((l) => l.availableFrom)
    .filter((d): d is Date => d instanceof Date);
  const earliest = futureDates.length
    ? new Date(Math.min(...futureDates.map((d) => d.getTime())))
    : null;
  const nextAvailable = earliest ? earliest.toISOString() : null;

  return NextResponse.json(
    { openCount, lowestRent, nextAvailable },
    { status: 200, headers: CORS_HEADERS }
  );
}
