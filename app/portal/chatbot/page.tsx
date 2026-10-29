import type { Metadata } from "next";
import { headers } from "next/headers";
import { ChatbotCaptureMode, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { ChatbotStudio } from "./chatbot-studio";
import { readGtmContainerId } from "@/components/tenant-site/tenant-analytics";
import { MasterToggle } from "./master-toggle";
import { LeadRoutingPanel } from "./lead-routing-panel";
import { InstallSnippet } from "./install-snippet";
import { ChatbotInstallSnippetPicker } from "./chatbot-install-snippet-picker";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { visibleProperties, propertyOrOrgLevelWhereFragment } from "@/lib/tenancy/property-filter";
import { chatbotSnippet } from "@/lib/chatbot/snippet";
import Link from "next/link";
import type { ConnectionStatus } from "@/components/portal/ui/status-chip";
import { PerformanceOverTime, type PerformancePoint } from "@/components/portal/dashboard/performance-over-time";
import { Metric, Panel, Pill, ago, change } from "@/components/portal/overview/kit";
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
  // Property-restricted operators only see conversations from their
  // buildings plus org-level (no-property) chats, matching the
  // conversations list. AND-wrapped: the fragment is an OR and some queries
  // below carry their own OR. No-op for unrestricted users.
  const convScope: Prisma.ChatbotConversationWhereInput = {
    AND: [propertyOrOrgLevelWhereFragment(scope, null)],
  };

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
    rawChatbotProperties,
    applied,
    openFixes,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        name: true,
        shortName: true,
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
        primaryCtaText: true,
        primaryCtaUrl: true,
        phoneNumber: true,
        contactEmail: true,
      },
    }),
    resolveAppUrl(),
    // Conversation stats — three windowed counts + how many of those
    // conversations captured an intake (email/phone) so the chatbot's
    // contribution to pipeline reads at a glance. Run in parallel.
    Promise.all([
      prisma.chatbotConversation.count({
        where: { orgId: scope.orgId, ...convScope, lastMessageAt: { gte: since1d } },
      }),
      prisma.chatbotConversation.count({
        where: { orgId: scope.orgId, ...convScope, lastMessageAt: { gte: since7d } },
      }),
      prisma.chatbotConversation.count({
        where: { orgId: scope.orgId, ...convScope, lastMessageAt: { gte: since30d } },
      }),
      prisma.chatbotConversation.count({
        where: {
          orgId: scope.orgId,
          ...convScope,
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
          ...convScope,
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
    getChatbotAnalytics({ orgId: scope.orgId, propertyWhere: convScope, periodDays: 30 }).catch(() => null),
    getProspectIntel({ orgId: scope.orgId, propertyWhere: convScope, periodDays: 30 }).catch(() => null),
    // Multi-property picker (Wave 3 phase 6): only fetched/shown when the
    // org actually has more than one marketable property — single-property
    // orgs keep the plain org-wide snippet, matching every other
    // property-picker surface's showPicker convention
    prisma.property
      .findMany({
        where: marketablePropertyWhere(scope.orgId),
        select: { id: true, name: true, slug: true, websiteUrl: true },
        orderBy: { name: "asc" },
      })
      .catch((e) => {
        console.error("[chatbot] property list failed", e);
        return [] as Array<{ id: string; name: string; slug: string; websiteUrl: string | null }>;
      }),
    prisma.chatbotKnowledgeSuggestion
      .findMany({
        where: { orgId: scope.orgId, ...fixScope(scope.allowedPropertyIds), status: "APPLIED", appliedAt: { gte: since30d } },
        orderBy: { appliedAt: "desc" },
        take: 4,
        select: { id: true, suggestedText: true, appliedAt: true, affectedCount: true, property: { select: { name: true } } },
      })
      .catch((e) => {
        console.error("[chatbot] applied fixes failed", e);
        return [];
      }),
    prisma.chatbotKnowledgeSuggestion
      .count({ where: { orgId: scope.orgId, ...fixScope(scope.allowedPropertyIds), status: "OPEN" } })
      .catch((e) => {
        console.error("[chatbot] open fixes count failed", e);
        return 0;
      }),
  ]);

  if (!org) return null;

  // Property-restricted operators must only see/generate snippets for
  // buildings in their grant — every sibling picker filters the same way.
  const chatbotProperties = visibleProperties(scope, rawChatbotProperties);

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
  const snippet = chatbotSnippet(snippetHost, org.slug);

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

  // Heartbeat: Live if the widget reported activity in the last 7 days,
  // Stale if it has reported before, otherwise Not connected. Last-known
  // server state, no live probe.
  const HEARTBEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const lastActivityAt = latestConversation?.lastMessageAt ?? null;
  const installStatus: ConnectionStatus = lastActivityAt
    ? now - lastActivityAt.getTime() <= HEARTBEAT_WINDOW_MS
      ? "live"
      : "stale"
    : "not_connected";
  const lastActivityLabel = lastActivityAt ? `last chat ${ago(lastActivityAt, now)} ago` : null;

  // The master switch wins: a widget with recent chats is still hidden
  // when the toggle is off.
  const on = initial.chatbotEnabled && org.moduleChatbot;
  const persona = initial.chatbotPersonaName || "Your chatbot";
  const recipients = (org.notifyLeadEmail ?? "").split(",").map((e) => e.trim()).filter(Boolean).length;
  const routingOn = recipients > 0 && org.notifyOnChatbotLead;
  const captureRate = stats.d30 ? Math.round((stats.intakes30d / stats.d30) * 100) : 0;
  const questions = analytics?.topQuestions.slice(0, 5) ?? [];
  const maxQ = questions[0]?.count ?? 1;
  const site = chatbotProperties.find((p) => p.websiteUrl)?.websiteUrl ?? null;

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--t-ink)]">Chatbot</h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--t-muted)]">
            {persona} answers renters on your site{chatbotProperties.length > 1 ? ` across ${chatbotProperties.length} properties` : ""}
            {lastActivityLabel ? ` · ${lastActivityLabel}` : ""}
          </p>
        </div>
        <span className="inline-flex h-8 items-center gap-3 self-start rounded-full border border-[var(--t-border)] bg-white pl-3 pr-2 text-[12.5px] text-[var(--t-text)] md:self-auto">
          {on ? (installStatus === "live" ? <Pill tone="good">Live on your site</Pill> : <Pill tone="warn">On, not installed yet</Pill>) : <Pill>Hidden from visitors</Pill>}
          <MasterToggle enabled={initial.chatbotEnabled} moduleActive={org.moduleChatbot} variant="inline" />
        </span>
      </header>

      {!org.moduleChatbot ? (
        <div role="status" className="flex items-center gap-3 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-white px-4 py-3 shadow-[var(--t-shadow)]">
          <Pill tone="warn">Module not active</Pill>
          <p className="flex-1 text-[13px] text-[var(--t-muted)]">Set everything up below. It goes live the moment you activate it (free during trial).</p>
          <a href="/portal/marketplace" className="inline-flex h-8 items-center rounded-full bg-[var(--t-primary-bg)] px-3.5 text-[13px] font-medium text-white hover:opacity-90">Activate</a>
        </div>
      ) : null}

      <ChatbotStudio
        initial={initial}
        orgPrimaryColor={org.primaryColor}
        moduleActive={org.moduleChatbot}
        siteLabel={site ?? `${org.slug}.com`}
        previewBase={{
          slug: org.slug,
          brandName: chatbotProperties.length === 1 ? chatbotProperties[0].name : org.shortName ?? org.name,
          orgName: org.shortName ?? org.name,
          primaryCtaText: existingConfig?.primaryCtaText ?? null,
          primaryCtaUrl: existingConfig?.primaryCtaUrl ?? null,
          phoneNumber: existingConfig?.phoneNumber ?? null,
          contactEmail: existingConfig?.contactEmail ?? null,
        }}
        routing={<LeadRoutingPanel notifyLeadEmail={org.notifyLeadEmail} notifyOnChatbotLead={org.notifyOnChatbotLead} bare />}
        routingStatus={{ ok: routingOn, summary: routingOn ? `Emailing ${recipients} ${recipients === 1 ? "person" : "people"}` : "No one gets lead emails yet" }}
        install={
          chatbotProperties.length > 1 ? (
            <ChatbotInstallSnippetPicker properties={chatbotProperties} snippetHost={snippetHost} orgSlug={org.slug} status={installStatus} lastActivityLabel={lastActivityLabel} defaultCollapsed={false} bare />
          ) : (
            <InstallSnippet snippet={snippet} status={installStatus} lastActivityLabel={lastActivityLabel} bare />
          )
        }
        installStatus={{
          ok: installStatus === "live",
          summary: installStatus === "live" ? `On your site · ${lastActivityLabel}` : installStatus === "stale" ? "Quiet for 7+ days" : "Not on your site yet",
        }}
        insights={
          <>
            <Panel title="Last 30 days" flush>
              <dl className="grid grid-cols-2 [&>*]:border-[var(--t-divider)] [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b">
                <Metric label="Conversations" value={stats.d30.toLocaleString()} delta={change(stats.d30, prior30Total)} />
                <Metric label="Leads" value={stats.intakes30d.toLocaleString()} />
                <Metric label="Capture rate" value={`${captureRate}%`} />
                <Metric label="This week" value={stats.d7.toLocaleString()} />
              </dl>
            </Panel>
            <Panel
              title="Learned recently"
              aside={openFixes ? <Link href="/portal/conversations/insights" className="text-[var(--t-accent)] hover:underline">Review {openFixes}</Link> : null}
              flush
            >
              {applied.length ? (
                <ul className="divide-y divide-[var(--t-divider)]">
                  {applied.map((a) => (
                    <li key={a.id} className="px-4 py-3">
                      <p className="line-clamp-2 text-[13px] leading-snug text-[var(--t-ink)]">{a.suggestedText}</p>
                      <p className="mt-1 flex items-center gap-2 text-[12px] text-[var(--t-muted)]">
                        <Pill tone="good">Live</Pill>
                        {a.appliedAt ? `${ago(a.appliedAt, now)} ago` : ""}
                        {a.affectedCount ? ` · from ${a.affectedCount} chats` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">
                  {openFixes ? `${openFixes} fixes drafted from real chats are waiting for you.` : "When a chat goes unanswered, a fix is drafted here for you to approve."}
                </p>
              )}
            </Panel>
            <Panel title="What renters ask first" flush>
              {questions.length ? (
                <ul className="divide-y divide-[var(--t-divider)]">
                  {questions.map((q) => (
                    <li key={q.question} className="px-4 py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[13px] text-[var(--t-ink)]">{q.question}</span>
                        <span className="shrink-0 text-[12px] tabular-nums text-[var(--t-muted)]">{q.count}</span>
                      </div>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--t-wash)]">
                        <span className="block h-full rounded-full bg-[var(--t-accent)]" style={{ width: `${Math.max(6, (q.count / maxQ) * 100)}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-[13px] text-[var(--t-muted)]">Top questions show up as conversations come in.</p>
              )}
            </Panel>
          </>
        }
      />

      {hasAnyConversations ? (
        <Panel title="Conversations per day" aside="Last 30 days vs the 30 before">
          <PerformanceOverTime points={chartPoints} compare />
        </Panel>
      ) : null}

      {/* Hidden until there is enough to read a pattern from. */}
      {prospects && prospects.profiles >= 5 ? (
        <Panel title="What prospects want" aside={`${prospects.profiles} profiles${prospects.medianBudget != null ? ` · median budget $${prospects.medianBudget.toLocaleString()}/mo` : ""}`}>
          <div className="grid gap-6 md:grid-cols-3">
            <Dist title="Room type" rows={prospects.roomTypes} />
            <Dist title="Move-in" rows={prospects.moveIn} />
            <Dist title="Also touring" rows={prospects.competitors} />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function fixScope(allowed: string[] | null | undefined) {
  return allowed ? { propertyId: { in: allowed } } : {};
}

function Dist({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = rows[0]?.count ?? 1;
  return (
    <div>
      <h3 className="text-[12.5px] font-medium text-[var(--t-text)]">{title}</h3>
      {rows.length ? (
        <ul className="mt-2.5 space-y-2">
          {rows.slice(0, 5).map((r) => (
            <li key={r.label} className="grid grid-cols-[96px_1fr_28px] items-center gap-3 text-[13px]">
              <span className="truncate capitalize text-[var(--t-ink)]">{r.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-[var(--t-wash)]">
                <span className="block h-full rounded-full bg-[var(--t-accent)]" style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums text-[var(--t-muted)]">{r.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-[13px] text-[var(--t-muted)]">Nothing mentioned yet.</p>
      )}
    </div>
  );
}
