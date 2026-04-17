import type { TenantSiteConfig } from "@prisma/client";
import { ProactiveWidget } from "./proactive-widget";

// Server component. Rendered inside app/(tenant)/layout.tsx once the tenant
// has `moduleChatbot` and `TenantSiteConfig.enableChatbot` turned on. All
// personalization comes from TenantSiteConfig.
export function ChatbotLoader({
  orgId,
  config,
}: {
  orgId: string;
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
      personaName={personaName}
      avatarUrl={config.chatbotAvatarUrl ?? null}
      greeting={greeting}
      idleTriggerSeconds={idleTriggerSeconds}
    />
  );
}
