import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { formatDistanceToNow } from "date-fns";
import { ChatbotCaptureMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { ChatbotConfigForm } from "./chatbot-config-form";
import { readGtmContainerId } from "@/components/tenant-site/tenant-analytics";
import { MasterToggle } from "./master-toggle";
import { InstallSnippet } from "./install-snippet";
import { PageHeader, SectionCard } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";

// Builds the canonical embed URL for the install snippet. We always serve
// the snippet from `www.leasestack.co` so the host page doesn't pay the
// 307 redirect from the apex on every script load. Local dev falls back
// to the request origin when NEXT_PUBLIC_APP_URL isn't set.
async function resolveAppUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    const trimmed = fromEnv.replace(/\/$/, "");
    if (/^https?:\/\/leasestack\.co$/i.test(trimmed)) {
      return "https://www.leasestack.co";
    }
    return trimmed;
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  if (host === "leasestack.co") return "https://www.leasestack.co";
  return `${proto}://${host}`;
}

export default async function ChatbotPage() {
  const scope = await requireScope();

  // Window cutoffs for the conversation-stats strip (Norman bug #91:
  // chatbot page should lead with engagement numbers, configuration
  // below). 1d / 7d / 30d match the other portal surfaces' cadence.
  const now = Date.now();
  const since1d = new Date(now - 1 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    org,
    existingConfig,
    appUrl,
    recentConversations,
    convStats,
  ] = await Promise.all([
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
        chatbotFollowUpMessage: true,
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
    // Compact recent-conversation feed — keeps the chatbot page honest
    // about what's happening live without turning the surface into a
    // full chat-app UI. Capped to 6 rows; deep-link sends operators to
    // the lead detail for the full transcript.
    prisma.chatbotConversation
      .findMany({
        where: { orgId: scope.orgId },
        orderBy: { lastMessageAt: "desc" },
        take: 6,
        select: {
          id: true,
          status: true,
          messageCount: true,
          capturedName: true,
          capturedEmail: true,
          lastMessageAt: true,
          leadId: true,
          pageUrl: true,
        },
      })
      .catch(() => []),
    // Conversation stats — three windowed counts + how many of those
    // conversations captured an intake (email/phone) so the chatbot's
    // contribution to pipeline reads at a glance. Run in parallel.
    Promise.all([
      prisma.chatbotConversation.count({
        where: { orgId: scope.orgId, lastMessageAt: { gte: since1d } },
      }),
      prisma.chatbotConversation.count({
        where: { orgId: scope.orgId, lastMessageAt: { gte: since7d } },
      }),
      prisma.chatbotConversation.count({
        where: { orgId: scope.orgId, lastMessageAt: { gte: since30d } },
      }),
      prisma.chatbotConversation.count({
        where: {
          orgId: scope.orgId,
          lastMessageAt: { gte: since30d },
          OR: [
            { capturedEmail: { not: null } },
            { capturedPhone: { not: null } },
          ],
        },
      }),
    ])
      .then(([d1, d7, d30, intakes30d]) => ({ d1, d7, d30, intakes30d }))
      .catch(() => ({ d1: 0, d7: 0, d30: 0, intakes30d: 0 })),
  ]);

  if (!org) return null;

  const initial = {
    chatbotEnabled: existingConfig?.chatbotEnabled ?? false,
    chatbotAvatarUrl: existingConfig?.chatbotAvatarUrl ?? "",
    chatbotPersonaName: existingConfig?.chatbotPersonaName ?? "",
    chatbotGreeting: existingConfig?.chatbotGreeting ?? "",
    chatbotFollowUpMessage: existingConfig?.chatbotFollowUpMessage ?? "",
    chatbotTeaserText: existingConfig?.chatbotTeaserText ?? "",
    chatbotBrandColor: existingConfig?.chatbotBrandColor ?? "",
    chatbotCaptureMode:
      existingConfig?.chatbotCaptureMode ?? ChatbotCaptureMode.ON_INTENT,
    chatbotKnowledgeBase: existingConfig?.chatbotKnowledgeBase ?? "",
    chatbotIdleTriggerSeconds: existingConfig?.chatbotIdleTriggerSeconds ?? 5,
    ga4MeasurementId: existingConfig?.ga4MeasurementId ?? "",
    gtmContainerId: readGtmContainerId(existingConfig?.customJson) ?? "",
  };

  // Pin install snippet to the canonical www host. NEXT_PUBLIC_APP_URL
  // (which appUrl derives from) currently points at the apex, and
  // Vercel's apex → www auto-redirect (HTTP 307) does not carry CORS
  // headers — so an embed snippet referencing the apex would silently
  // fail to fetch its config from a customer site. See popup snippet
  // in app/portal/popups/[id]/page.tsx for the full diagnosis.
  const snippetHost = appUrl.replace(
    /^https:\/\/leasestack\.co/i,
    "https://www.leasestack.co",
  );
  const snippet = `<script src="${snippetHost}/embed/chatbot.js" data-slug="${org.slug}" defer></script>`;

  // Norman bug #91: lead with the insight (conversation volume +
  // recent transcripts) so operators land on a useful dashboard, then
  // drop into configuration. Configuration is still the bulk of the
  // page — but it's no longer the first thing the operator sees.
  const stats = convStats;
  const hasAnyConversations = stats.d30 > 0 || recentConversations.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbot"
        description="See how the AI leasing assistant is performing on your site, then tune persona, knowledge, and capture rules below."
      />

      {!org.moduleChatbot ? (
        <div
          role="status"
          className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 text-sm text-foreground flex items-start gap-3"
        >
          <div className="flex-1">
            <p className="font-semibold">Chatbot module isn&apos;t active yet.</p>
            <p className="text-muted-foreground text-[13px] mt-0.5 leading-relaxed">
              You can still stage your persona, greeting, and knowledge
              base below. The chatbot goes live the moment you activate
              the module from the marketplace (free during trial).
            </p>
          </div>
          <a
            href="/portal/marketplace"
            className="shrink-0 inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 h-8 text-xs font-semibold hover:bg-primary-dark transition-colors"
          >
            Activate
          </a>
        </div>
      ) : null}

      {/* ── INSIGHT (top of page per #91) ──────────────────────────── */}
      {hasAnyConversations ? (
        <SectionCard
          label="Performance"
          description="Conversation volume and intake capture over the last day, week, and month."
        >
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ChatbotStatTile label="Conversations · 1d" value={stats.d1} />
            <ChatbotStatTile label="Conversations · 7d" value={stats.d7} />
            <ChatbotStatTile label="Conversations · 30d" value={stats.d30} />
            <ChatbotStatTile
              label="Intakes captured · 30d"
              value={stats.intakes30d}
              hint={
                stats.d30 > 0
                  ? `${Math.round((stats.intakes30d / stats.d30) * 100)}% capture rate`
                  : undefined
              }
            />
          </dl>
        </SectionCard>
      ) : null}

      {recentConversations.length > 0 ? (
        <SectionCard
          label="Recent conversations"
          description="Most recent visitor chats with this bot. Click through to the full transcript on the lead detail page."
        >
          <ul className="divide-y divide-border -mx-1">
            {recentConversations.map((c) => {
              const name =
                c.capturedName?.trim() ||
                c.capturedEmail?.trim() ||
                "Anonymous visitor";
              const href = c.leadId
                ? `/portal/leads/${c.leadId}`
                : `/portal/conversations?conversation=${c.id}`;
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 px-1 py-2.5 -mx-0.5 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          c.status === "ACTIVE"
                            ? "var(--terracotta)"
                            : "rgb(156, 163, 175)",
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                        {c.messageCount}{" "}
                        {c.messageCount === 1 ? "message" : "messages"}
                        {c.pageUrl ? ` · ${c.pageUrl}` : ""}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {formatDistanceToNow(c.lastMessageAt, { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── CONFIGURATION (below insight per #91) ──────────────────── */}
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

// Small stat tile used only on this page. Mirrors the dashboard
// KpiTile shape without pulling the heavier component in — keeps the
// chatbot config bundle slim.
function ChatbotStatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <dt className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground truncate">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold text-foreground tabular-nums leading-none">
        {value.toLocaleString()}
      </dd>
      {hint ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
