import "server-only";
import { prisma } from "@/lib/db";
import {
  ChatbotCaptureMode,
  type PropertyChatbotConfig,
  type TenantSiteConfig,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Per-property chatbot config resolution (slice S1).
//
// A workspace runs ONE org-level chatbot config (TenantSiteConfig) by default.
// Each property MAY have a PropertyChatbotConfig override whose every field is
// nullable — a null field inherits the org value, mirroring the per-property
// NULL-fallback pattern already used by Cursive pixel + SEO integrations.
//
// `resolveChatbotConfig(orgId, propertyId?)` returns a merged config whose KEYS
// match TenantSiteConfig's chatbot fields, so it is a drop-in for any consumer
// that previously read `org.tenantSiteConfig` (the embed config route + the
// system-prompt builder). Pass no propertyId to get the pure org config.
// ---------------------------------------------------------------------------

export type ResolvedChatbotConfig = {
  // Which layer supplied the effective `chatbotEnabled` + most fields. Useful
  // for portal UI ("inheriting org default") and for tests.
  source: "property" | "org" | "none";
  chatbotEnabled: boolean;
  chatbotAvatarUrl: string | null;
  chatbotPersonaName: string | null;
  chatbotGreeting: string | null;
  chatbotFollowUpMessage: string | null;
  chatbotTeaserText: string | null;
  chatbotBrandColor: string | null;
  chatbotCaptureMode: ChatbotCaptureMode;
  chatbotKnowledgeBase: string | null;
  chatbotIdleTriggerSeconds: number;
  primaryCtaText: string | null;
  primaryCtaUrl: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  ga4MeasurementId: string | null;
};

// Field-level fallback: property value wins when non-null, else org value, else
// the type default. Pure + synchronous so it is unit-testable without a DB.
export function mergeChatbotConfig(
  org: TenantSiteConfig | null,
  property: PropertyChatbotConfig | null,
): ResolvedChatbotConfig {
  const pick = <T>(p: T | null | undefined, o: T | null | undefined): T | null =>
    p ?? o ?? null;

  // enabled is the one boolean where `false` must override, not inherit — so we
  // can't use ?? on the merged value alone; check the property's explicit
  // boolean first (null = inherit), then fall back to org, then false.
  const enabled =
    property?.chatbotEnabled ?? org?.chatbotEnabled ?? false;

  const source: ResolvedChatbotConfig["source"] = property
    ? "property"
    : org
      ? "org"
      : "none";

  return {
    source,
    chatbotEnabled: enabled,
    chatbotAvatarUrl: pick(property?.chatbotAvatarUrl, org?.chatbotAvatarUrl),
    chatbotPersonaName: pick(
      property?.chatbotPersonaName,
      org?.chatbotPersonaName,
    ),
    chatbotGreeting: pick(property?.chatbotGreeting, org?.chatbotGreeting),
    chatbotFollowUpMessage: pick(
      property?.chatbotFollowUpMessage,
      org?.chatbotFollowUpMessage,
    ),
    chatbotTeaserText: pick(property?.chatbotTeaserText, org?.chatbotTeaserText),
    chatbotBrandColor: pick(property?.chatbotBrandColor, org?.chatbotBrandColor),
    chatbotCaptureMode:
      property?.chatbotCaptureMode ??
      org?.chatbotCaptureMode ??
      ChatbotCaptureMode.ON_INTENT,
    chatbotKnowledgeBase: pick(
      property?.chatbotKnowledgeBase,
      org?.chatbotKnowledgeBase,
    ),
    chatbotIdleTriggerSeconds:
      property?.chatbotIdleTriggerSeconds ??
      org?.chatbotIdleTriggerSeconds ??
      5,
    primaryCtaText: pick(property?.primaryCtaText, org?.primaryCtaText),
    primaryCtaUrl: pick(property?.primaryCtaUrl, org?.primaryCtaUrl),
    phoneNumber: pick(property?.phoneNumber, org?.phoneNumber),
    contactEmail: pick(property?.contactEmail, org?.contactEmail),
    ga4MeasurementId: pick(property?.ga4MeasurementId, org?.ga4MeasurementId),
  };
}

// DB-backed resolver. Loads the org config and (when a propertyId is given) the
// property override, then merges. Fails soft: a DB error yields a disabled
// config rather than throwing, so the public embed never 500s.
export async function resolveChatbotConfig(
  orgId: string,
  propertyId?: string | null,
): Promise<ResolvedChatbotConfig> {
  try {
    const [org, property] = await Promise.all([
      prisma.tenantSiteConfig.findUnique({ where: { orgId } }),
      // Scope the property override by orgId too (Codex tenant-isolation): a
      // propertyId belonging to another org must NOT merge its knowledge base /
      // contact into this tenant's config. findFirst with the property relation
      // pinned to orgId returns null on any cross-tenant mismatch.
      propertyId
        ? prisma.propertyChatbotConfig
            .findFirst({ where: { propertyId, property: { orgId } } })
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    return mergeChatbotConfig(org, property);
  } catch {
    return mergeChatbotConfig(null, null);
  }
}
