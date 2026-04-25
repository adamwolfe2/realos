import type { Organization, TenantSiteConfig } from "@prisma/client";
import { ProactiveWidget } from "./proactive-widget";

// Server component. Rendered inside app/(tenant)/layout.tsx once the tenant
// has `moduleChatbot` and `TenantSiteConfig.enableChatbot` turned on. All
// personalization comes from the Organization row + TenantSiteConfig.
export function ChatbotLoader({
  orgId,
  slug,
  brandName,
  config,
}: {
  orgId: string;
  slug: string;
  brandName: string;
  config: TenantSiteConfig | null;
}) {
  if (!config?.enableChatbot) return null;

  const personaName = config.chatbotPersonaName?.trim() || "Leasing";
  const greeting =
    config.chatbotGreeting?.trim() ||
    "Hey, I'm around if you have any questions about the building, tours, or applying.";
  const idleTriggerSeconds =
    typeof config.chatbotIdleTriggerSeconds === "number"
      ? config.chatbotIdleTriggerSeconds
      : 5;

  return (
    <ProactiveWidget
      orgId={orgId}
      slug={slug}
      brandName={brandName}
      personaName={personaName}
      avatarUrl={config.chatbotAvatarUrl ?? null}
      greeting={greeting}
      idleTriggerSeconds={idleTriggerSeconds}
      primaryCtaText={config.primaryCtaText ?? null}
      primaryCtaUrl={config.primaryCtaUrl ?? null}
      phoneNumber={config.phoneNumber ?? null}
      contactEmail={config.contactEmail ?? null}
    />
  );
}

// Convenience overload for callers that already have the full Organization.
// Keeps the layout tidy without leaking Prisma types into the widget props.
export function ChatbotLoaderFor({
  tenant,
  config,
}: {
  tenant: Pick<Organization, "id" | "slug" | "name" | "shortName">;
  config: TenantSiteConfig | null;
}) {
  return (
    <ChatbotLoader
      orgId={tenant.id}
      slug={tenant.slug}
      brandName={tenant.shortName ?? tenant.name}
      config={config}
    />
  );
}
