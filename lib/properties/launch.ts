/**
 * Per-property launch checklist + status computation.
 *
 * The David/Norman scenario:
 *   - SG Real Estate (David's org) has 122 ACTIVE properties
 *   - Telegraph Commons is LIVE — site built, chatbot live, GA4/GSC
 *     connected, ads running
 *   - 5 more properties are in flight (CDO requested rebuilds with
 *     chatbot + ads + GSC + GA4 hookups)
 *   - The other 116 are in DRAFT until the operator gets to them
 *
 * This module computes:
 *   1. The detailed checklist for a single property — what's done,
 *      what's pending. Powers the /portal/properties/[id]/onboarding
 *      tab.
 *
 * It does not write launchStatus; that is stored on Property and set
 * elsewhere (operator overrides flip launchStatusSetBy=OPERATOR).
 */

import "server-only";
import { prisma } from "@/lib/db";
import type { PropertyLaunchStatus } from "@prisma/client";

// A chatbot is "firing" (proven live on the operator's real site) only if a
// visitor conversation landed in the last 14 days. Real student-housing sites
// get traffic daily; 14 days is generous enough for weekend lulls and short
// outages.
const CHATBOT_FRESHNESS_DAYS = 14;

export type ChecklistItem = {
  key:
    | "marketing_content"
    | "chatbot_configured"
    | "chatbot_firing"
    | "popups_created"
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

  const chatbotSince = new Date(
    Date.now() - CHATBOT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000,
  );

  // Norman bug (May 30): the launch checklist was reporting "GA4 not
  // connected" on properties where GA4 was wired at the org level
  // (propertyId=null). Same root cause as the integrations sidebar
  // fix in overview.tsx — strict `{ orgId, propertyId }` filters skip
  // org-wide rows. Switched to OR-with-null pattern: prefer the
  // property-specific row if present, otherwise fall back to the
  // org-wide row. Mirrors the production pickIntegration logic.
  const [
    seoRows,
    googleCampaign,
    metaCampaign,
    chatbotConfig,
    popup,
    lastChatbotConversation,
  ] = await Promise.all([
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
    // Real "chatbot is live" evidence: the most recent visitor conversation
    // for THIS property. The embed (public/embed/chatbot.js) only produces a
    // ChatbotConversation once it has actually executed on the operator's live
    // site and a visitor engaged — so a recent row proves the snippet is
    // installed and rendering, not just that chatbotEnabled=true in the DB.
    // Scoped STRICTLY to this propertyId (no org-wide/null fallback) so one
    // property's traffic can never mark another property's bot "live".
    prisma.chatbotConversation
      .findFirst({
        where: { orgId, propertyId },
        orderBy: { lastMessageAt: "desc" },
        select: { lastMessageAt: true },
      })
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

  // Config is the "installed" half, a recent conversation is the "firing"
  // half. Only counts as firing when
  // the bot is also configured (a stray conversation on a disabled bot
  // shouldn't mark the step done).
  const lastChatAt = lastChatbotConversation?.lastMessageAt ?? null;
  const chatbotFiring =
    chatbotConfigured && lastChatAt != null && lastChatAt >= chatbotSince;

  // Checklist is gated by the workspace's enabled features so each property
  // only shows the setup steps for features it actually has. Every item is
  // scoped to THIS property (its own GA4, GSC, chatbot, popups) — full
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
    items.push({
      key: "chatbot_firing",
      label: "Chatbot live on site",
      description: `We've seen a chatbot conversation on this property's site in the last ${CHATBOT_FRESHNESS_DAYS} days.`,
      done: chatbotFiring,
      detail: chatbotFiring
        ? `Last conversation ${lastChatAt?.toISOString().slice(0, 10)}.`
        : chatbotConfigured
          ? lastChatAt
            ? `Configured, but the last conversation was ${lastChatAt.toISOString().slice(0, 10)}. Confirm the embed snippet is still on your live site.`
            : "Configured, but no conversations yet. Paste the embed snippet on your live site and confirm the widget renders for visitors."
          : null,
      actionLabel: chatbotConfigured ? "Install embed snippet" : null,
      actionHref: chatbotConfigured
        ? `/portal/properties/${property.id}?tab=chatbot`
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
