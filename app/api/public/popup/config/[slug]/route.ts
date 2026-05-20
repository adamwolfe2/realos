import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActivePopupsForEmbed } from "@/lib/popups/queries";
import {
  chatbotConfigLimiter,
  checkRateLimit,
  getIp,
  WIDGET_FALLBACK,
} from "@/lib/rate-limit";

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
// Rate limit: chatbotConfigLimiter (30/min/IP) as defense-in-depth on
// top of Vercel's edge firewall. The embed polls infrequently (cached
// 60s), so a single user shouldn't approach 30/min from one IP under
// normal use. A scraper enumerating tenant slugs would trip this.
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
  // Defense-in-depth rate-limit (Vercel firewall handles the floor).
  // Keyed by IP so one shared scraper IP can't enumerate tenant slugs
  // without tripping after 30 hits in a minute.
  const ip = getIp(req);
  const rl = await checkRateLimit(chatbotConfigLimiter, ip, {
    softFallback: WIDGET_FALLBACK.chatbotConfig,
  });
  if (!rl.allowed) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((rl.reset - Date.now()) / 1000),
    );
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: { ...CORS_HEADERS, "Retry-After": String(retryAfterSec) },
      },
    );
  }

  const { slug } = await ctx.params;
  if (!slug || typeof slug !== "string" || slug.length > 100) {
    return NextResponse.json(
      { ok: false, error: "Invalid tenant slug." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Optional property scoping via query param. The embed passes the
  // current property's slug (set on the script tag as data-property).
  // Capped at 100 chars defensively — without this, a malicious site
  // could cache-bust by varying the ?property= value (long arbitrary
  // strings still go through the org lookup), poisoning the s-maxage
  // 60s cache with a fresh entry per unique value.
  const propertySlugRaw = req.nextUrl.searchParams.get("property");
  const propertySlug =
    propertySlugRaw && propertySlugRaw.length <= 100 ? propertySlugRaw : null;

  // Cache headers applied to ALL branches uniformly. Pre-fix only the
  // success path set Cache-Control, which combined with two different
  // codepaths (org found + module on vs org missing) leaked the
  // existence of a slug via timing + cache state. Uniform headers
  // collapse that signal.
  const cacheHeaders = {
    ...CORS_HEADERS,
    "Cache-Control": "public, max-age=60, s-maxage=60",
  } as const;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, modulePopups: true },
  });
  if (!org) {
    return NextResponse.json(
      { ok: true, popups: [] }, // soft-404 — return empty so the embed quietly does nothing
      { status: 200, headers: cacheHeaders },
    );
  }

  if (!org.modulePopups) {
    // Module disabled — return empty so an old install snippet on a
    // cancelled tenant doesn't keep firing.
    return NextResponse.json(
      { ok: true, popups: [] },
      { status: 200, headers: cacheHeaders },
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

  // Same cacheHeaders as the empty branches above — uniform across
  // every codepath so a slug-enumeration attacker can't infer org
  // existence from a difference in headers.
  return NextResponse.json(
    { ok: true, popups: payload },
    { status: 200, headers: cacheHeaders },
  );
}
