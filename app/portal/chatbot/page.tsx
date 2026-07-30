import type { Metadata } from "next";
import { headers } from "next/headers";
import { ChatbotCaptureMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { ChatbotConfigForm } from "./chatbot-config-form";
import { readGtmContainerId } from "@/components/tenant-site/tenant-analytics";
import { MasterToggle } from "./master-toggle";
import { LeadRoutingPanel } from "./lead-routing-panel";
import { InstallSnippet } from "./install-snippet";
import { PageHeader } from "@/components/admin/page-header";
import {
  StatusChip,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";
import type { PerformancePoint } from "@/components/portal/dashboard/performance-over-time";
import { ChatbotPerformancePanel } from "./performance-panel";
import {
  getChatbotAnalytics,
  getProspectIntel,
} from "@/lib/chatbot/conversation-analytics";

export const metadata: Metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";
// Server actions on this page (notably the lead-routing backfill in
// lib/actions/chatbot-config.ts) can run up to ~50 sec when processing
// a large queue. Explicitly request the Vercel Pro ceiling so a
// future serverless-default downgrade doesn't silently cap us.
export const maxDuration = 60;

// Builds the canonical embed URL for the install snippet.
//
// 2026-06-04: primary domain swapped to APEX (was www-primary) so the
// snippet now serves from `https://leasestack.co` directly. Pre-swap
// we rewrote apex → www to avoid a 307 hop; post-swap that logic is
// inverted, so we rewrite the OTHER direction: any www variant gets
// normalized to apex so the host page doesn't pay the 308 redirect
// from www → apex on every script load.
async function resolveAppUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    const trimmed = fromEnv.replace(/\/$/, "");
    if (/^https?:\/\/www\.leasestack\.co$/i.test(trimmed)) {
      return "https://leasestack.co";
    }
    return trimmed;
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  if (host === "www.leasestack.co") return "https://leasestack.co";
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
    convStats,
    convDays,
    latestConversation,
    analytics,
    prospects,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        moduleChatbot: true,
        primaryColor: true,
        notifyLeadEmail: true,
        notifyOnChatbotLead: true,
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
    // Per-day conversation volume, current 30d + prior 30d, for the
    // performance chart. Tiny result set (SG: ~166 rows / 60d) — bucket
    // in JS, same approach as getPerformanceOverTime.
    prisma.chatbotConversation
      .findMany({
        where: {
          orgId: scope.orgId,
          lastMessageAt: { gte: new Date(now - 60 * 24 * 60 * 60 * 1000) },
        },
        select: { lastMessageAt: true },
      })
      .catch(() => [] as Array<{ lastMessageAt: Date }>),
    // Install heartbeat. There is no dedicated lastSeenAt / installVerifiedAt
    // column and the widget's config fetch is edge-cached (can't be logged),
    // so the strongest install proof is the most recent conversation the
    // widget has reported. Read-only; the InstallSnippet Verify button just
    // re-runs this read via router.refresh().
    prisma.chatbotConversation
      .findFirst({
        where: { orgId: scope.orgId },
        orderBy: { lastMessageAt: "desc" },
        select: { lastMessageAt: true },
      })
      .catch(() => null),
    // Questions tab — top opening questions + topic keywords (heuristic,
    // no AI cost). Prospects tab — aggregates over the Haiku-extracted
    // profiles the digest cron already produced.
    getChatbotAnalytics({ orgId: scope.orgId, periodDays: 30 }).catch(() => null),
    getProspectIntel({ orgId: scope.orgId, periodDays: 30 }).catch(() => null),
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
  // 2026-06-04 primary-domain swap: APEX is now primary and www 308s
  // to apex. The pre-swap workaround rewrote apex → www to avoid a
  // cross-origin redirect on the embed fetch (the redirect response
  // doesn't carry CORS headers). Now the safe direction is the
  // opposite — normalize any www down to apex so the embed snippet
  // fetches the canonical host directly.
  const snippetHost = appUrl.replace(
    /^https:\/\/www\.leasestack\.co/i,
    "https://leasestack.co",
  );
  const snippet = `<script src="${snippetHost}/embed/chatbot.js" data-slug="${org.slug}" defer></script>`;

  // Norman bug #91: lead with the insight (conversation volume) so
  // operators land on a useful dashboard, then drop into configuration.
  // Configuration is still the bulk of the page — but it's no longer
  // the first thing the operator sees.
  const stats = convStats;
  const hasAnyConversations = stats.d30 > 0;

  // Bucket conversations into per-day points, current 30d with the prior
  // 30d as the comparison series (same shape the dashboard chart uses).
  const DAY_MS = 24 * 60 * 60 * 1000;
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const buckets = new Map<string, number>();
  for (const c of convDays) buckets.set(dayKey(c.lastMessageAt), (buckets.get(dayKey(c.lastMessageAt)) ?? 0) + 1);
  const chartPoints: PerformancePoint[] = Array.from({ length: 30 }, (_, i) => {
    const cur = new Date(now - (29 - i) * DAY_MS);
    const prior = new Date(cur.getTime() - 30 * DAY_MS);
    return {
      date: dayKey(cur),
      label: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      current: buckets.get(dayKey(cur)) ?? 0,
      comparison: buckets.get(dayKey(prior)) ?? 0,
    };
  });
  const prior30Total = chartPoints.reduce((s, p) => s + (p.comparison ?? 0), 0);
  const d30DeltaPct =
    prior30Total > 0
      ? Math.round(((stats.d30 - prior30Total) / prior30Total) * 100)
      : null;

  // Heartbeat chip state: Live if the widget reported activity in the last
  // 7 days, Stale if it has ever reported but has gone quiet, otherwise
  // Not connected. Rendered from last-known server state — no live probe.
  const HEARTBEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const lastActivityAt = latestConversation?.lastMessageAt ?? null;
  const installStatus: ConnectionStatus = lastActivityAt
    ? now - lastActivityAt.getTime() <= HEARTBEAT_WINDOW_MS
      ? "live"
      : "stale"
    : "not_connected";
  const lastActivityLabel = lastActivityAt
    ? `last activity ${lastActivityAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : null;

  return (
    <div className="space-y-6">
      {/* Redesign 2026-07-29 (Adam): analytics lead, configuration follows,
          install verification collapsed at the bottom once the widget is
          live. Status + master switch live in the header, not in cards. */}
      <PageHeader
        title="Chatbot"
        description="How your AI leasing assistant is performing, and how it behaves."
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <StatusChip status={installStatus} />
              {lastActivityLabel ? (
                <span className="hidden md:inline text-[11px] text-muted-foreground tabular-nums">
                  {lastActivityLabel}
                </span>
              ) : null}
            </span>
            <MasterToggle
              enabled={initial.chatbotEnabled}
              moduleActive={org.moduleChatbot}
              variant="inline"
            />
          </div>
        }
      />

      {!org.moduleChatbot ? (
        <div
          role="status"
          className="rounded-[2px] border border-primary/20 bg-primary/[0.03] p-4 text-sm text-foreground flex items-start gap-3"
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
            className="shrink-0 inline-flex items-center rounded-[2px] bg-primary text-primary-foreground px-3 h-8 text-xs font-semibold hover:bg-primary-dark transition-colors"
          >
            Activate
          </a>
        </div>
      ) : null}

      {/* ── PERFORMANCE (leads the page) — one card, three tabbed views:
          Volume / Questions / Prospects. Same footprint, more data. */}
      {hasAnyConversations ? (
        <ChatbotPerformancePanel
          points={chartPoints}
          d30={stats.d30}
          d7={stats.d7}
          intakes30d={stats.intakes30d}
          d30DeltaPct={d30DeltaPct}
          analytics={analytics}
          prospects={prospects}
        />
      ) : null}

      {/* ── BEHAVIOR ─────────────────────────────────────────────────── */}
      <LeadRoutingPanel
        notifyLeadEmail={org.notifyLeadEmail}
        notifyOnChatbotLead={org.notifyOnChatbotLead}
      />

      <ChatbotConfigForm
        initial={initial}
        orgPrimaryColor={org.primaryColor}
        moduleActive={org.moduleChatbot}
      />

      {/* ── INSTALLATION (bottom; collapsed once the widget is live) ── */}
      <InstallSnippet
        snippet={snippet}
        status={installStatus}
        lastActivityLabel={lastActivityLabel}
        defaultCollapsed={installStatus === "live"}
      />
    </div>
  );
}
