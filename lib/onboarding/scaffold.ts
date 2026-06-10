import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Per-property scaffolding (slice S3).
//
// When a workspace selects features and adds properties, each property should
// land READY to configure rather than blank. This helper provisions, per
// property, the per-property instances for the features that are actually on:
//
//   - Chatbot  -> a PropertyChatbotConfig row (enabled), so every property has
//                 its own bot live + editable. Also ensures the org-level
//                 TenantSiteConfig exists + chatbotEnabled so the bot can
//                 actually serve (the public endpoints gate on it).
//   - Pixel    -> one PixelProvisionRequest per property, so the ops/automation
//                 queue gets N distinct requests (the 5-properties-5-pixels
//                 bottleneck) instead of the operator filing each by hand.
//
// Idempotent: safe to call again on onboarding resume. PropertyChatbotConfig is
// keyed @unique by propertyId (upsert); pixel requests are de-duped by an
// embedded `property:<id>` marker in notes.
// ---------------------------------------------------------------------------

export type ScaffoldFeatures = {
  chatbot: boolean;
  pixel: boolean;
};

export type ScaffoldProperty = {
  id: string;
  name: string;
  websiteUrl: string | null;
};

const PIXEL_NOTE_PREFIX = "property:";

export async function scaffoldPropertyIntegrations(
  orgId: string,
  properties: ScaffoldProperty[],
  features: ScaffoldFeatures,
): Promise<void> {
  if (properties.length === 0) return;

  // --- Chatbot baseline (org-level) so per-property bots can serve. -------
  if (features.chatbot) {
    await prisma.tenantSiteConfig
      .upsert({
        where: { orgId },
        // Don't stomp an operator's existing greeting/persona on resume — only
        // ensure the row exists + the master toggle is on.
        update: { chatbotEnabled: true },
        create: { orgId, chatbotEnabled: true },
      })
      .catch(() => undefined);
  }

  for (const property of properties) {
    if (features.chatbot) {
      await prisma.propertyChatbotConfig
        .upsert({
          where: { propertyId: property.id },
          update: {}, // leave any existing per-property config untouched
          create: {
            orgId,
            propertyId: property.id,
            // Enabled for this property out of the gate; persona defaults to
            // the property name so each bot introduces the right building.
            chatbotEnabled: true,
            chatbotPersonaName: property.name,
          },
        })
        .catch(() => undefined);
    }

    if (features.pixel) {
      const marker = `${PIXEL_NOTE_PREFIX}${property.id}`;
      const already = await prisma.pixelProvisionRequest
        .findFirst({
          where: { orgId, notes: { contains: marker } },
          select: { id: true },
        })
        .catch(() => null);
      if (!already) {
        await prisma.pixelProvisionRequest
          .create({
            data: {
              orgId,
              websiteName: property.name,
              websiteUrl: property.websiteUrl ?? "",
              notes: `Auto-requested at onboarding for ${property.name} (${marker})`,
            },
          })
          .catch(() => undefined);
      }
    }
  }
}
