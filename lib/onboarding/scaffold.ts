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

  // Collect (rather than swallow) per-step failures. Scaffolding stays
  // best-effort — one property's failure never stops the rest from being
  // provisioned — but every failure must survive to the end so the caller's
  // Sentry capture (see app/api/onboarding/wizard/properties/route.ts) can
  // actually see it. Swallowing here made that outer .catch() dead code.
  const failures: string[] = [];

  // --- Chatbot baseline (org-level) so per-property bots can serve. -------
  if (features.chatbot) {
    try {
      await prisma.tenantSiteConfig.upsert({
        where: { orgId },
        // Don't stomp an operator's existing greeting/persona on resume — only
        // ensure the row exists + the master toggle is on.
        update: { chatbotEnabled: true },
        create: { orgId, chatbotEnabled: true },
      });
    } catch (err) {
      failures.push(`org tenant site config: ${(err as Error).message}`);
    }
  }

  for (const property of properties) {
    if (features.chatbot) {
      try {
        await prisma.propertyChatbotConfig.upsert({
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
        });
      } catch (err) {
        failures.push(
          `chatbot config for property ${property.id}: ${(err as Error).message}`,
        );
      }
    }

    if (features.pixel) {
      const marker = `${PIXEL_NOTE_PREFIX}${property.id}`;
      try {
        const already = await prisma.pixelProvisionRequest.findFirst({
          where: { orgId, notes: { contains: marker } },
          select: { id: true },
        });
        if (!already) {
          await prisma.pixelProvisionRequest.create({
            data: {
              orgId,
              propertyId: property.id,
              websiteName: property.name,
              websiteUrl: property.websiteUrl ?? "",
              notes: `Auto-requested at onboarding for ${property.name} (${marker})`,
            },
          });
        }
      } catch (err) {
        failures.push(
          `pixel request for property ${property.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `scaffoldPropertyIntegrations: ${failures.length} scaffold step(s) failed for org ${orgId}: ${failures.join("; ")}`,
    );
  }
}
