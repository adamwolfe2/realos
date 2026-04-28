import type { Metadata } from "next";
import { headers } from "next/headers";
import { ChatbotCaptureMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { ChatbotConfigForm } from "./chatbot-config-form";
import { readGtmContainerId } from "@/components/tenant-site/tenant-analytics";
import { MasterToggle } from "./master-toggle";
import { InstallSnippet } from "./install-snippet";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";

// Fallback to the request origin when NEXT_PUBLIC_APP_URL isn't set (local
// dev). Vercel sets the env var so production always uses the canonical URL.
async function resolveAppUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export default async function ChatbotPage() {
  const scope = await requireScope();

  const [org, existingConfig, appUrl] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        moduleChatbot: true,
        primaryColor: true,
      },
    }),
    prisma.tenantSiteConfig.findUnique({
      where: { orgId: scope.orgId },
      select: {
        chatbotEnabled: true,
        chatbotAvatarUrl: true,
        chatbotPersonaName: true,
        chatbotGreeting: true,
        chatbotTeaserText: true,
        chatbotBrandColor: true,
        chatbotCaptureMode: true,
        chatbotKnowledgeBase: true,
        chatbotIdleTriggerSeconds: true,
        ga4MeasurementId: true,
        customJson: true,
      },
    }),
    resolveAppUrl(),
  ]);

  if (!org) return null;

  const initial = {
    chatbotEnabled: existingConfig?.chatbotEnabled ?? false,
    chatbotAvatarUrl: existingConfig?.chatbotAvatarUrl ?? "",
    chatbotPersonaName: existingConfig?.chatbotPersonaName ?? "",
    chatbotGreeting: existingConfig?.chatbotGreeting ?? "",
    chatbotTeaserText: existingConfig?.chatbotTeaserText ?? "",
    chatbotBrandColor: existingConfig?.chatbotBrandColor ?? "",
    chatbotCaptureMode:
      existingConfig?.chatbotCaptureMode ?? ChatbotCaptureMode.ON_INTENT,
    chatbotKnowledgeBase: existingConfig?.chatbotKnowledgeBase ?? "",
    chatbotIdleTriggerSeconds: existingConfig?.chatbotIdleTriggerSeconds ?? 5,
    ga4MeasurementId: existingConfig?.ga4MeasurementId ?? "",
    gtmContainerId: readGtmContainerId(existingConfig?.customJson) ?? "",
  };

  const snippet = `<script src="${appUrl}/embed/chatbot.js" data-slug="${org.slug}" defer></script>`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbot"
        description="Configure the AI leasing assistant that embeds on your marketing site. Changes go live the next time a visitor loads your page."
      />

      {!org.moduleChatbot ? (
        <div
          role="status"
          className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md p-4 text-sm"
        >
          Chatbot module isn&apos;t active on your plan. Contact your account
          manager to turn it on. You can still stage content below — it will
          activate the moment billing is enabled.
        </div>
      ) : null}

      <MasterToggle
        enabled={initial.chatbotEnabled}
        moduleActive={org.moduleChatbot}
      />

      <ChatbotConfigForm
        initial={initial}
        orgPrimaryColor={org.primaryColor}
        moduleActive={org.moduleChatbot}
      />

      <InstallSnippet snippet={snippet} />
    </div>
  );
}
