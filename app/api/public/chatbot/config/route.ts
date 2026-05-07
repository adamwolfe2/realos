import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  chatbotConfigLimiter,
  checkRateLimit,
  getIp,
  rateLimited,
} from "@/lib/rate-limit";

// GET /api/public/chatbot/config?slug=<org-slug>
//
// Returns the chatbot configuration for the embed widget. This endpoint is
// unauthenticated by design — it's called cross-origin from the operator's
// website. If the org is not provisioned or the chatbot is disabled, we
// return `{ enabled: false }` and the widget silently vanishes on the host
// page (graceful degradation).

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
  const { allowed } = await checkRateLimit(chatbotConfigLimiter, `cfg:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60, { ...CORS_HEADERS });
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
    return NextResponse.json(
      { enabled: false },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  if (!org || org.orgType !== "CLIENT" || !org.moduleChatbot) {
    return NextResponse.json(
      { enabled: false },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const cfg = org.tenantSiteConfig;
  if (!cfg || !cfg.chatbotEnabled) {
    return NextResponse.json(
      { enabled: false },
      { status: 200, headers: CORS_HEADERS }
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
      avatarUrl: cfg.chatbotAvatarUrl ?? org.logoUrl ?? null,
      captureMode: cfg.chatbotCaptureMode,
      idleTriggerSeconds: cfg.chatbotIdleTriggerSeconds,
      primaryCtaText: cfg.primaryCtaText ?? null,
      primaryCtaUrl: cfg.primaryCtaUrl ?? null,
      phoneNumber: cfg.phoneNumber ?? null,
      contactEmail: cfg.contactEmail ?? null,
      ga4MeasurementId: cfg.ga4MeasurementId ?? null,
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
