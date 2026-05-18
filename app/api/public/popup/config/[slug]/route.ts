import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActivePopupsForEmbed } from "@/lib/popups/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/public/popup/config/[slug]
//
// Public endpoint hit by /embed/popup.js on every install. Returns the
// active popup campaigns for the org identified by `slug` (the
// Organization.slug from the script tag's data-tenant attribute).
//
// CORS: wide open with no credentials so any external site can fetch
// the config. Returns ONLY public-safe fields — no propertyId, no
// orgId, no analytics counters, no audit trail.
//
// Rate limit: handled at the edge by Vercel. No tenant-level guard
// here because the response is fully public anyway.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!slug || typeof slug !== "string" || slug.length > 100) {
    return NextResponse.json(
      { ok: false, error: "Invalid tenant slug." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Optional property scoping via query param. The embed passes the
  // current property's slug (set on the script tag as data-property).
  const propertySlug = req.nextUrl.searchParams.get("property");

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, modulePopups: true },
  });
  if (!org) {
    return NextResponse.json(
      { ok: true, popups: [] }, // soft-404 — return empty so the embed quietly does nothing
      { status: 200, headers: CORS_HEADERS },
    );
  }

  if (!org.modulePopups) {
    // Module disabled — return empty so an old install snippet on a
    // cancelled tenant doesn't keep firing.
    return NextResponse.json(
      { ok: true, popups: [] },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  const popups = await getActivePopupsForEmbed(org.id, propertySlug);

  // Project to public-safe shape. We deliberately do NOT include
  // orgId, propertyId, internal counters, or audit-time fields.
  const payload = popups.map((p) => ({
    id: p.id,
    headline: p.headline,
    body: p.body,
    ctaText: p.ctaText,
    ctaUrl: p.ctaUrl,
    offerCode: p.offerCode,
    secondaryText: p.secondaryText,
    trigger: p.trigger,
    triggerThreshold: p.triggerThreshold,
    targetUrlPatterns: Array.isArray(p.targetUrlPatterns)
      ? (p.targetUrlPatterns as string[])
      : [],
    frequency: p.frequency,
    position: p.position,
    primaryColor: p.primaryColor,
    textColor: p.textColor,
    backgroundColor: p.backgroundColor,
    heroImageUrl: p.heroImageUrl,
    captureEmail: p.captureEmail,
    capturePhone: p.capturePhone,
  }));

  return NextResponse.json(
    { ok: true, popups: payload },
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        // Short cache so config edits propagate within ~minutes. The
        // operator iteration loop on /portal/popups expects fast
        // feedback when they hit Publish.
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
