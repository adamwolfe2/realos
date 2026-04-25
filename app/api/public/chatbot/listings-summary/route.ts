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

  const listings = org.properties.flatMap((p) => p.listings);
  const openCount = listings.length;

  const rents = listings
    .map((l) => l.priceCents)
    .filter((c): c is number => typeof c === "number" && c > 0);
  const lowestCents = rents.length ? Math.min(...rents) : null;
  const lowestRent = lowestCents
    ? Math.round(lowestCents / 100)
    : null;

  const futureDates = listings
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
