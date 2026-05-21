import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  chatbotConfigLimiter,
  checkRateLimit,
  getIp,
  rateLimited,
  WIDGET_FALLBACK,
} from "@/lib/rate-limit";

// GET /api/public/chatbot/config?slug=<org-slug>
//
// Returns the chatbot configuration for the embed widget. This endpoint is
// unauthenticated by design — it's called cross-origin from the operator's
// website. If the org is not provisioned or the chatbot is disabled, we
// return `{ enabled: false }` and the widget silently vanishes on the host
// page (graceful degradation).

export const runtime = "nodejs";
// `dynamic = "force-dynamic"` was previously set here — it told Vercel
// to bypass the CDN cache and invoke the handler on every request,
// which made the Cache-Control headers below completely useless and
// meant every chatbot visitor hit the rate limiter directly. Removing
// it so Vercel's edge cache actually engages: 99%+ of requests now
// short-circuit at the edge with the cached 200 response and never
// reach this handler at all. The rate limiter is now belt-and-
// suspenders for the rare cache miss.
//
// `revalidate = 60` belts the `Cache-Control: s-maxage=60` response
// headers below by also opting Next.js's data cache into the same
// 60s window, so framework-level caching agrees with the CDN.
export const revalidate = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

// Edge-cache successful config responses for 60s, with a 10-minute
// stale-while-revalidate window so the embed never blocks on a cold
// CDN miss. The chatbot config changes only when an operator edits it
// in the LeaseStack portal — sub-minute freshness is fine and keeps
// the route off the DB / rate-limiter critical path. `private=false`
// implied by `public` so Vercel's edge will hold a shared copy.
//
// We don't cache the rate-limited or "no slug" branches: those are
// either error states or unauthenticated probes, and we'd rather hit
// the limiter again than pin a bad response to the edge for a minute.
const SUCCESS_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
  // Vary on the only request signal that actually changes the body —
  // some CDNs choke without an explicit Vary even when the URL alone
  // determines the cache key.
  Vary: "Accept-Encoding",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(chatbotConfigLimiter, `cfg:${ip}`, {
    softFallback: WIDGET_FALLBACK.chatbotConfig,
  });
  if (!allowed) {
    // Cache the 429 too — otherwise a misbehaving client (or a hot
    // edge node with no cached success response) loops on the
    // rate-limit error and re-invokes the handler 60×/sec. The
    // s-maxage=10 window is short enough that the visitor recovers
    // quickly once they back off, but long enough that we don't spam
    // the limiter from the same edge.
    return rateLimited("Rate limit exceeded", 60, {
      ...CORS_HEADERS,
      "Cache-Control": "public, s-maxage=10",
    });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json(
      { enabled: false },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // Wrap the DB read so a transient outage / migration in flight never
  // 500s the embed widget. The widget runs on every customer site, so
  // any 500 here renders a broken UI on telegraphcommons.com (etc).
  // Graceful-degrade to { enabled: false } and the widget silently
  // vanishes on the host page until we recover.
  // Narrow `org` to the exact shape returned by our `select` (instead
  // of the wider Awaited<findUnique> that doesn't see the select
  // discriminator). Without this Prisma's per-property migration
  // confused the inferred type of the relation reads below.
  type OrgConfig = {
    id: string;
    name: string;
    shortName: string | null;
    orgType: string;
    moduleChatbot: boolean;
    primaryColor: string | null;
    logoUrl: string | null;
    properties: Array<{ name: string; slug: string }>;
    tenantSiteConfig: {
      chatbotEnabled: boolean;
      chatbotPersonaName: string | null;
      chatbotGreeting: string | null;
      chatbotFollowUpMessage: string | null;
      chatbotTeaserText: string | null;
      chatbotBrandColor: string | null;
      chatbotAvatarUrl: string | null;
      chatbotCaptureMode: string;
      chatbotIdleTriggerSeconds: number;
      primaryCtaText: string | null;
      primaryCtaUrl: string | null;
      phoneNumber: string | null;
      contactEmail: string | null;
      ga4MeasurementId: string | null;
    } | null;
  } | null;
  let org: OrgConfig = null;
  try {
    org = (await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        shortName: true,
        orgType: true,
        moduleChatbot: true,
        primaryColor: true,
        logoUrl: true,
        // Pull all properties so we can scope to the one whose slug matches
        // the embed slug. Falls back to the most-recently-updated property's
        // name (legacy behavior) when no slug match is found.
        properties: {
          orderBy: { updatedAt: "desc" },
          select: { name: true, slug: true },
        },
        tenantSiteConfig: {
          select: {
            chatbotEnabled: true,
            chatbotPersonaName: true,
            chatbotGreeting: true,
            chatbotFollowUpMessage: true,
            chatbotTeaserText: true,
            chatbotBrandColor: true,
            chatbotAvatarUrl: true,
            chatbotCaptureMode: true,
            chatbotIdleTriggerSeconds: true,
            primaryCtaText: true,
            primaryCtaUrl: true,
            phoneNumber: true,
            contactEmail: true,
            ga4MeasurementId: true,
          },
        },
      },
    })) as OrgConfig;
  } catch (err) {
    console.warn("[public/chatbot/config] DB read failed:", err);
    // DB outage — don't cache this branch. We want to retry on the
    // next request so the chatbot recovers automatically when the DB
    // comes back.
    return NextResponse.json(
      { enabled: false },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  if (!org || org.orgType !== "CLIENT" || !org.moduleChatbot) {
    // Cache "unknown slug" / "module off" for 60s too — protects the
    // limiter and DB from drive-by probes hitting the same slug.
    return NextResponse.json(
      { enabled: false },
      {
        status: 200,
        headers: { ...CORS_HEADERS, ...SUCCESS_CACHE_HEADERS },
      },
    );
  }

  const cfg = org.tenantSiteConfig;
  if (!cfg || !cfg.chatbotEnabled) {
    return NextResponse.json(
      { enabled: false },
      {
        status: 200,
        headers: { ...CORS_HEADERS, ...SUCCESS_CACHE_HEADERS },
      },
    );
  }

  // Multi-property orgs (e.g. SG Real Estate has Telegraph Commons +
  // Yosemite Avenue Apartments) need the embed scoped to a single property.
  // Match by property slug = embed slug. If nothing matches, fall back to
  // the org's shortName or name (single-property orgs typically don't have
  // a property whose slug equals the org slug, so this preserves their
  // legacy behavior).
  const matchedProperty = org.properties.find((p) => p.slug === slug);
  const brandName =
    matchedProperty?.name ??
    org.shortName ??
    org.name ??
    org.properties[0]?.name ??
    "Leasing";

  return NextResponse.json(
    {
      enabled: true,
      orgId: org.id,
      slug,
      brandName,
      personaName: cfg.chatbotPersonaName ?? "Leasing",
      greeting:
        cfg.chatbotGreeting ??
        `Hi! I'm with ${org.shortName ?? org.name}. What can I help you with?`,
      // Operator-editable second message. NULL/empty = suppress
      // (greeting only). Embed widget interpolates placeholders
      // {property_name}, {starting_rent}, {open_count},
      // {next_available} against live inventory data.
      followUpMessage: cfg.chatbotFollowUpMessage ?? null,
      teaserText: cfg.chatbotTeaserText ?? "Questions? I'm here.",
      brandColor: cfg.chatbotBrandColor ?? org.primaryColor ?? "#111111",
      // Avatar is ONLY the operator-configured chatbot avatar. Previously
      // we fell back to `org.logoUrl` so the chatbot launcher always had
      // some image, but that surfaced wordmarks / property logos in the
      // circular avatar slot (e.g. "TELEGRAPH COMM" cropped inside a
      // round frame on telegraphcommons.com), which read as a broken
      // render. Reporter screenshot 2026-05-20. The embed now renders an
      // explicit user-icon fallback when avatarUrl is null.
      avatarUrl: cfg.chatbotAvatarUrl ?? null,
      captureMode: cfg.chatbotCaptureMode,
      idleTriggerSeconds: cfg.chatbotIdleTriggerSeconds,
      primaryCtaText: cfg.primaryCtaText ?? null,
      primaryCtaUrl: cfg.primaryCtaUrl ?? null,
      phoneNumber: cfg.phoneNumber ?? null,
      contactEmail: cfg.contactEmail ?? null,
      ga4MeasurementId: cfg.ga4MeasurementId ?? null,
    },
    {
      status: 200,
      headers: { ...CORS_HEADERS, ...SUCCESS_CACHE_HEADERS },
    },
  );
}
