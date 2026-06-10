/**
 * Per-property launch checklist + status computation.
 *
 * The David/Norman scenario:
 *   - SG Real Estate (David's org) has 122 ACTIVE properties
 *   - Telegraph Commons is LIVE — site built, pixel firing, GA4/GSC
 *     connected, ads running
 *   - 5 more properties are in flight (CDO requested rebuilds with
 *     pixel + ads + GSC + GA4 hookups)
 *   - The other 116 are in DRAFT until the operator gets to them
 *
 * This module computes:
 *   1. The detailed checklist for a single property — what's done,
 *      what's pending. Powers the /portal/properties/[id]/onboarding
 *      tab.
 *   2. The derived launchStatus from that checklist. Used by the
 *      auto-recompute (background job or property edit hook) to
 *      promote DRAFT → ONBOARDING → LIVE without operator involvement.
 *
 * Source-of-truth note: launchStatus is stored on Property so reads
 * stay cheap. This module only writes when the auto-recompute decides
 * a transition. Operator overrides flip launchStatusSetBy=OPERATOR
 * which makes the row sticky against future auto-recomputes.
 */

import "server-only";
import { prisma } from "@/lib/db";
import type { PropertyLaunchStatus } from "@prisma/client";

// 14 days = consider a pixel "firing" if it logged an event in the
// last 14 days. Real student-housing sites get traffic daily; 14 days
// is generous enough to forgive weekend lulls and short outages.
const PIXEL_FRESHNESS_DAYS = 14;

export type ChecklistItem = {
  key:
    | "marketing_content"
    | "chatbot_configured"
    | "popups_created"
    | "pixel_installed"
    | "pixel_firing"
    | "ga4_connected"
    | "gsc_connected"
    | "google_ads_connected"
    | "meta_ads_connected";
  label: string;
  description: string;
  done: boolean;
  detail: string | null;
  // CTA the onboarding page renders next to incomplete items.
  actionLabel: string | null;
  actionHref: string | null;
  // Whether this item is required to flip to LIVE. Some items (Meta
  // Ads, Google Ads) are optional — a property can be LIVE without
  // running paid traffic.
  required: boolean;
};

export type LaunchChecklist = {
  propertyId: string;
  status: PropertyLaunchStatus;
  setBy: "AUTO" | "OPERATOR";
  items: ChecklistItem[];
  // Convenience derivations for the UI.
  completedRequiredCount: number;
  totalRequiredCount: number;
  completedOptionalCount: number;
  totalOptionalCount: number;
};

export async function getLaunchChecklist(
  orgId: string,
  propertyId: string,
): Promise<LaunchChecklist | null> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    select: {
      id: true,
      slug: true,
      heroImageUrl: true,
      metaTitle: true,
      metaDescription: true,
      description: true,
      launchStatus: true,
      launchStatusSetBy: true,
      // Which features the workspace actually bought — the checklist is gated
      // to these so a property only shows setup steps for the features that
      // apply to it (a workspace without SEO never sees "Connect GA4").
      org: {
        select: {
          moduleChatbot: true,
          modulePixel: true,
          moduleSEO: true,
          moduleGoogleAds: true,
          moduleMetaAds: true,
          modulePopups: true,
        },
      },
    },
  });
  if (!property) return null;
  const modules = property.org;

  const since = new Date(
    Date.now() - PIXEL_FRESHNESS_DAYS * 24 * 60 * 60 * 1000,
  );

  // Norman bug (May 30): the launch checklist was reporting "GA4 not
  // connected" on properties where GA4 was wired at the org level
  // (propertyId=null). Same root cause as the integrations sidebar
  // fix in overview.tsx — strict `{ orgId, propertyId }` filters skip
  // org-wide rows. Switched to OR-with-null pattern: prefer the
  // property-specific row if present, otherwise fall back to the
  // org-wide row. Mirrors the production pickIntegration logic.
  const [cursive, seoRows, googleCampaign, metaCampaign, chatbotConfig, popup] =
    await Promise.all([
    prisma.cursiveIntegration.findFirst({
      where: { orgId, OR: [{ propertyId }, { propertyId: null }] },
      orderBy: { propertyId: { sort: "desc", nulls: "last" } },
      select: {
        cursivePixelId: true,
        installedOnDomain: true,
        lastEventAt: true,
      },
    }),
    prisma.seoIntegration.findMany({
      where: { orgId, OR: [{ propertyId }, { propertyId: null }] },
      select: {
        provider: true,
        lastSyncAt: true,
        propertyId: true,
      },
    }),
    prisma.adCampaign.findFirst({
      where: { orgId, propertyId, platform: "GOOGLE_ADS" },
      select: { id: true, name: true, status: true },
    }),
    prisma.adCampaign.findFirst({
      where: { orgId, propertyId, platform: "META" },
      select: { id: true, name: true, status: true },
    }),
    // Per-property chatbot override row (S1/S3). Its existence + enabled flag
    // tells us whether this property's own bot is set up.
    prisma.propertyChatbotConfig
      .findUnique({
        where: { propertyId },
        select: { chatbotEnabled: true, chatbotKnowledgeBase: true },
      })
      .catch(() => null),
    // Per-property popups — any PopupCampaign scoped to this property.
    prisma.popupCampaign
      .findFirst({ where: { orgId, propertyId }, select: { id: true } })
      .catch(() => null),
  ]);

  // Prefer the property-specific row over the org-wide (propertyId=null)
  // row when both exist — mirrors pickIntegration in overview.tsx.
  const pickRow = (provider: "GA4" | "GSC") => {
    const matches = seoRows.filter((r) => r.provider === provider);
    if (matches.length === 0) return undefined;
    return (
      matches.find((r) => r.propertyId === propertyId) ??
      matches.find((r) => r.propertyId === null) ??
      matches[0]
    );
  };
  const ga4 = pickRow("GA4");
  const gsc = pickRow("GSC");

  const pixelInstalled = Boolean(cursive?.cursivePixelId);
  const pixelFiring =
    pixelInstalled &&
    cursive?.lastEventAt != null &&
    cursive.lastEventAt >= since;

  // "Marketing content" — minimal-viable check. The property page
  // needs at least a hero image AND title to be presentable to a
  // visitor. metaDescription is nice-to-have but not blocking.
  const hasMarketingContent = Boolean(
    property.heroImageUrl &&
      (property.metaTitle || property.description),
  );

  const chatbotConfigured = Boolean(
    chatbotConfig && chatbotConfig.chatbotEnabled !== false,
  );

  // Checklist is gated by the workspace's enabled features so each property
  // only shows the setup steps for features it actually has. Every item is
  // scoped to THIS property (its own pixel, GA4, GSC, chatbot, popups) — full
  // per-property isolation.
  const items: ChecklistItem[] = [];

  items.push({
    key: "marketing_content",
    label: "Property page content",
    description:
      "Hero image and a property title or description are required so the marketing site has something to render.",
    done: hasMarketingContent,
    detail: hasMarketingContent
      ? "Hero image set; title or description present."
      : null,
    actionLabel: "Edit content",
    actionHref: `/portal/properties/${property.id}?tab=overview`,
    required: true,
  });

  if (modules?.moduleChatbot) {
    items.push({
      key: "chatbot_configured",
      label: "AI chatbot set up",
      description:
        "This property's own chatbot — give it a persona and a knowledge base with this building's facts.",
      done: chatbotConfigured,
      detail: chatbotConfigured
        ? chatbotConfig?.chatbotKnowledgeBase
          ? "Enabled with a property knowledge base."
          : "Enabled — add this property's facts to its knowledge base."
        : null,
      actionLabel: "Set up chatbot",
      actionHref: `/portal/properties/${property.id}?tab=chatbot`,
      required: true,
    });
  }

  if (modules?.modulePixel) {
    items.push({
      key: "pixel_installed",
      label: "Cursive Pixel installed",
      description:
        "This property's pixel snippet must be deployed on its marketing site so we can identify visitors.",
      done: pixelInstalled,
      detail: pixelInstalled
        ? `Pixel installed${cursive?.installedOnDomain ? ` on ${cursive.installedOnDomain}` : ""}.`
        : null,
      actionLabel: "Install pixel",
      actionHref: `/portal/integrations?propertyId=${property.id}`,
      required: true,
    });
    items.push({
      key: "pixel_firing",
      label: "Pixel firing",
      description: `We've seen a pixel event in the last ${PIXEL_FRESHNESS_DAYS} days.`,
      done: pixelFiring,
      detail: pixelFiring
        ? `Last event ${cursive?.lastEventAt?.toISOString().slice(0, 10)}.`
        : pixelInstalled
          ? "Pixel installed but no recent events. Verify the snippet is deployed and visitors are landing."
          : null,
      actionLabel: pixelInstalled ? "Re-check pixel" : null,
      actionHref: pixelInstalled
        ? `/portal/integrations?propertyId=${property.id}`
        : null,
      required: true,
    });
  }

  if (modules?.moduleSEO) {
    items.push({
      key: "ga4_connected",
      label: "Google Analytics 4 connected",
      description:
        "GA4 powers organic sessions, top pages, and bounce-rate metrics for this property.",
      done: Boolean(ga4),
      detail: ga4?.lastSyncAt
        ? `Last sync ${ga4.lastSyncAt.toISOString().slice(0, 10)}.`
        : ga4
          ? "Connected; awaiting first sync."
          : null,
      actionLabel: "Connect GA4",
      actionHref: `/portal/seo?provider=GA4&property=${property.id}`,
      required: true,
    });
    items.push({
      key: "gsc_connected",
      label: "Google Search Console connected",
      description:
        "GSC powers query, impression, click, and position data for this property.",
      done: Boolean(gsc),
      detail: gsc?.lastSyncAt
        ? `Last sync ${gsc.lastSyncAt.toISOString().slice(0, 10)}.`
        : gsc
          ? "Connected; awaiting first sync."
          : null,
      actionLabel: "Connect GSC",
      actionHref: `/portal/seo?provider=GSC&property=${property.id}`,
      required: true,
    });
  }

  if (modules?.modulePopups) {
    items.push({
      key: "popups_created",
      label: "Popups created",
      description:
        "Add at least one on-site popup (promo, referral, or exit-intent) for this property.",
      done: Boolean(popup),
      detail: popup ? "A popup is configured for this property." : null,
      actionLabel: "Create popup",
      actionHref: `/portal/popups?propertyId=${property.id}`,
      required: false,
    });
  }

  if (modules?.moduleGoogleAds) {
    items.push({
      key: "google_ads_connected",
      label: "Google Ads connected",
      description:
        "Optional — only required for properties running paid Google traffic.",
      done: Boolean(googleCampaign),
      detail: googleCampaign
        ? `${googleCampaign.name}${googleCampaign.status === "PAUSED" ? " (paused)" : ""}.`
        : null,
      actionLabel: "Connect Google Ads",
      actionHref: `/portal/ads?propertyId=${property.id}`,
      required: false,
    });
  }

  if (modules?.moduleMetaAds) {
    items.push({
      key: "meta_ads_connected",
      label: "Meta Ads connected",
      description:
        "Optional — only required for properties running paid Meta (Facebook/Instagram) traffic.",
      done: Boolean(metaCampaign),
      detail: metaCampaign
        ? `${metaCampaign.name}${metaCampaign.status === "PAUSED" ? " (paused)" : ""}.`
        : null,
      actionLabel: "Connect Meta Ads",
      actionHref: `/portal/ads?propertyId=${property.id}`,
      required: false,
    });
  }

  const requiredItems = items.filter((i) => i.required);
  const optionalItems = items.filter((i) => !i.required);
  const completedRequired = requiredItems.filter((i) => i.done).length;
  const completedOptional = optionalItems.filter((i) => i.done).length;

  return {
    propertyId: property.id,
    status: property.launchStatus,
    setBy: property.launchStatusSetBy,
    items,
    completedRequiredCount: completedRequired,
    totalRequiredCount: requiredItems.length,
    completedOptionalCount: completedOptional,
    totalOptionalCount: optionalItems.length,
  };
}

/**
 * Compute what the auto-recompute thinks the launchStatus should be,
 * based on checklist state. Pure function over the checklist — does
 * not write to the DB.
 *
 * Rules:
 *   - All required items done                → LIVE
 *   - At least one required item done        → ONBOARDING
 *   - Zero required items done               → DRAFT
 *
 * PAUSED is never set by auto — only by an operator override.
 */
export function deriveStatusFromChecklist(
  checklist: Pick<LaunchChecklist, "completedRequiredCount" | "totalRequiredCount">,
): PropertyLaunchStatus {
  if (checklist.totalRequiredCount === 0) return "DRAFT";
  if (checklist.completedRequiredCount === checklist.totalRequiredCount)
    return "LIVE";
  if (checklist.completedRequiredCount > 0) return "ONBOARDING";
  return "DRAFT";
}

/**
 * Run the auto-recompute for one property. Skips OPERATOR-set rows so
 * a deliberate "PAUSED" or manual promotion isn't silently reverted.
 *
 * Returns { changed, from, to } so callers can log transitions.
 */
export async function recomputeLaunchStatus(
  orgId: string,
  propertyId: string,
): Promise<{
  changed: boolean;
  from: PropertyLaunchStatus | null;
  to: PropertyLaunchStatus | null;
}> {
  const checklist = await getLaunchChecklist(orgId, propertyId);
  if (!checklist) return { changed: false, from: null, to: null };

  // Operator decisions are sticky.
  if (checklist.setBy === "OPERATOR") {
    return { changed: false, from: checklist.status, to: checklist.status };
  }

  const next = deriveStatusFromChecklist(checklist);
  if (next === checklist.status) {
    return { changed: false, from: checklist.status, to: checklist.status };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      launchStatus: next,
      launchStatusSetBy: "AUTO",
      launchStatusSetAt: new Date(),
      // Stamp launchedAt only on first promotion to LIVE so we can
      // tell when the property went live for SLA / reporting.
      ...(next === "LIVE" ? { launchedAt: new Date() } : {}),
    },
  });

  return { changed: true, from: checklist.status, to: next };
}
