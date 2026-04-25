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

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      shortName: true,
      orgType: true,
      moduleChatbot: true,
      primaryColor: true,
      logoUrl: true,
      properties: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { name: true },
      },
      tenantSiteConfig: {
        select: {
          chatbotEnabled: true,
          chatbotPersonaName: true,
          chatbotGreeting: true,
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
  });

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

  return NextResponse.json(
    {
      enabled: true,
      orgId: org.id,
      slug,
      brandName: org.properties[0]?.name ?? org.shortName ?? org.name,
      personaName: cfg.chatbotPersonaName ?? "Leasing",
      greeting:
        cfg.chatbotGreeting ??
        `Hi! I'm with ${org.shortName ?? org.name}. What can I help you with?`,
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
