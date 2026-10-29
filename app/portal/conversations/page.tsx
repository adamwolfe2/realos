import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  isAccessDenied,
  marketableScopedPropertyClause,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { ChatbotConversationStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { humanChatbotStatus } from "@/lib/format";
import {
  FlagPill,
  FLAG_TYPES,
  isFlagType,
  type FlagType,
} from "@/components/portal/conversations/flag-pill";
import { MessageSquare, BarChart3 } from "lucide-react";
import {
  TranscriptSearch,
  type SortOption,
} from "./transcript-search";
import { InlineTranscript } from "./inline-transcript";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chatbot conversations" };
export const dynamic = "force-dynamic";

type SerializedMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

type SortValue = SortOption["value"];

function isSort(v: string | undefined): v is SortValue {
  return v === "newest" || v === "longest" || v === "most_flagged";
}

// ---------------------------------------------------------------------------
// 2-pane inbox layout.
//
// LEFT  — Scrollable conversation list with search, filter chips, sort.
// RIGHT — Selected conversation transcript (via ?c=<id> URL param).
//
// All filter state still lives in URL params so views are bookmarkable.
// The selected conversation also lives in `?c=` so a refresh keeps the
// transcript in view. The legacy /portal/conversations/[id] page is
// preserved for direct deep-links and full flag/notes/handoff tooling
// (link from the inline transcript header).
// ---------------------------------------------------------------------------

export default async function ConversationsList({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    flag?: string;
    sort?: string;
    status?: string;
    property?: string;
    properties?: string;
    c?: string;
  }>;
}) {
  const gate = await requireModule("moduleConversations");
  if (gate) return gate;

  const scope = await requireScope();
  const sp = await searchParams;
  const propertyIds = await parsePropertyFilter(sp, scope.orgId);

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const properties = visibleProperties(scope, allProperties);

  const qRaw = (sp.q ?? "").trim();
  const flagParam = (sp.flag ?? "").trim();
  const sort: SortValue = isSort(sp.sort) ? sp.sort : "newest";
  const statusParam = sp.status && sp.status in ChatbotConversationStatus
    ? (sp.status as ChatbotConversationStatus)
    : undefined;
  const selectedId = (sp.c ?? "").trim() || null;

  let messageMatchIds: Set<string> | null = null;
  if (qRaw.length >= 2) {
    const like = `%${qRaw.replace(/[%_]/g, "\\$&")}%`;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ChatbotConversation"
      WHERE "orgId" = ${scope.orgId}
        AND "messages"::text ILIKE ${like}
      ORDER BY "lastMessageAt" DESC
      LIMIT 500
    `;
    messageMatchIds = new Set(rows.map((r) => r.id));
  }

  // Shared with the list query's `where` below so the KPI strip and the
  // filter-chip counts match what a property-restricted/filtered operator
  // can actually open (finding: counts were org-wide while the list was
  // property-gated).
  const propertyClause = await marketableScopedPropertyClause(
    scope,
    propertyIds,
    "propertyId",
    { defaultIncludesOrgRows: true },
  );

  const [totalConversations, flagCounts, qualityBadCount] = await Promise.all([
    prisma.chatbotConversation.count({
      where: { ...tenantWhere(scope), ...propertyClause },
    }),
    prisma.conversationFlag.groupBy({
      by: ["flag"],
      where: { orgId: scope.orgId, conversation: propertyClause },
      _count: { conversationId: true },
    }),
    prisma.conversationFlag.count({
      where: {
        orgId: scope.orgId,
        flag: "quality_bad",
        conversation: propertyClause,
      },
    }),
  ]);

  const flagCountMap = new Map<string, number>();
  for (const row of flagCounts) {
    flagCountMap.set(row.flag, row._count.conversationId);
  }

  // Filter chip set. We only ever render chips that mean something
  // right now: "All" is always shown, plus any flag chip that has at
  // least one row, plus the currently-selected chip (so the operator
  // can always click it off, even if its count just dropped to zero).
  // Operator feedback (2026-06-04): tenants with zero flagged
  // conversations were seeing 4 "0" pills competing with "All", which
  // read as broken / empty product surface rather than a useful
  // filter. Hiding zero-count chips keeps the inbox feeling alive.
  const allFlagChips: Array<{ key: string; label: string; count: number }> = [
    {
      key: "needs_prompt_tuning",
      label: "Needs prompt tuning",
      count: flagCountMap.get("needs_prompt_tuning") ?? 0,
    },
    {
      key: "lead_high_intent",
      label: "High intent leads",
      count: flagCountMap.get("lead_high_intent") ?? 0,
    },
    {
      key: "handoff_missed",
      label: "Missed handoffs",
      count: flagCountMap.get("handoff_missed") ?? 0,
    },
    {
      key: "quality_bad",
      label: "Flagged bad quality",
      count: qualityBadCount,
    },
  ];
  const filterChips = [
    { key: "", label: "All", count: totalConversations },
    ...allFlagChips.filter((c) => c.count > 0 || c.key === flagParam),
  ];

  const activeFlag: FlagType | null =
    flagParam && isFlagType(flagParam) ? flagParam : null;

  const where: Prisma.ChatbotConversationWhereInput = {
    ...tenantWhere(scope),
    // Default (no selection) scopes to enabled properties; org-level
    // conversations (propertyId=null) stay visible.
    ...propertyClause,
  };
  if (statusParam) where.status = statusParam;
  if (activeFlag) where.flags = { some: { flag: activeFlag } };
  if (messageMatchIds) {
    if (messageMatchIds.size === 0) {
      where.id = "__no_match__";
    } else {
      where.id = { in: Array.from(messageMatchIds) };
    }
  }

  let orderBy: Prisma.ChatbotConversationOrderByWithRelationInput;
  if (sort === "longest") {
    orderBy = { messageCount: "desc" };
  } else if (sort === "most_flagged") {
    orderBy = { flags: { _count: "desc" } };
  } else {
    orderBy = { lastMessageAt: "desc" };
  }

  const conversations = await prisma.chatbotConversation.findMany({
    where,
    orderBy,
    take: 200,
    include: {
      lead: { select: { id: true, status: true } },
      flags: { select: { flag: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { flags: true } },
    },
  });

  // Build base query string so list-item links preserve filters when
  // setting ?c=<id>. Only string params carry; we drop `c` then re-set it
  // per row.
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "c") continue;
    if (typeof v === "string" && v !== "") baseParams.set(k, v);
  }
  const baseQs = baseParams.toString();

  // If selectedId isn't in the visible list (e.g. operator switched the
  // filter to a chip that excludes it), still render the transcript pane
  // — it gives them a way to act on the conversation they intentionally
  // bookmarked. The InlineTranscript component does its own auth+tenant
  // check before returning data.
  // Inbox behaviour: with no row picked, open the newest conversation with messages so
  // the reading pane is never an empty prompt.
  const validSelectedId =
    selectedId && /^[a-zA-Z0-9_-]+$/.test(selectedId)
      ? selectedId
      : ((conversations.find((c) => firstUserMessage(c.messages)) ?? conversations[0])?.id ?? null);

  const inboxStats = [
    { label: "total", value: totalConversations },
    { label: "high intent", value: flagCountMap.get("lead_high_intent") ?? 0 },
    { label: "missed handoffs", value: flagCountMap.get("handoff_missed") ?? 0 },
    { label: "flagged", value: qualityBadCount },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] lg:h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Inbox</h1>
          <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
            {inboxStats.map((st, i) => (
              <span key={st.label}>
                {i > 0 ? " · " : null}
                <span className="font-medium text-foreground">{st.value.toLocaleString()}</span> {st.label}
              </span>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/conversations/insights"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-foreground ring-1 ring-inset ring-border hover:bg-muted/60"
          >
            <BarChart3 className="h-4 w-4" />
            Suggested fixes
          </Link>
          <Suspense fallback={<div className="h-9 w-64 animate-pulse bg-neutral-100 rounded-[2px]" />}>
            <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
          </Suspense>
        </div>
      </div>

      {isAccessDenied(scope, propertyIds) ? (
        <PropertyAccessDeniedBanner pathname="/portal/conversations" />
      ) : null}

      {/* 2-pane container */}
      <div className="flex-1 min-h-0 mt-4 grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] gap-3 lg:gap-0 lg:rounded-[12px] lg:ring-1 lg:ring-border lg:overflow-hidden">
        {/* LEFT: list pane */}
        <div className="flex flex-col min-h-0 lg:border-r lg:border-border overflow-hidden bg-[var(--t-wash)]">
          <div className="px-3 py-3 border-b border-border shrink-0">
            <Suspense>
              <TranscriptSearch
                filters={filterChips}
                initialQuery={qRaw}
                initialFilter={flagParam}
                initialSort={sort}
              />
            </Suspense>
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              Showing {conversations.length} of {totalConversations}
              {qRaw ? (
                <>
                  {" "}matching{" "}
                  <span className="font-semibold text-foreground">{qRaw}</span>
                </>
              ) : null}
            </p>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={
                    qRaw || activeFlag
                      ? "No conversations match this view."
                      : "No conversations yet."
                  }
                  body={
                    qRaw || activeFlag
                      ? "Try clearing your search or filter."
                      : "Conversations appear here the moment a visitor chats with your bot."
                  }
                  action={
                    qRaw || activeFlag
                      ? undefined
                      : { label: "Configure chatbot", href: "/portal/chatbot" }
                  }
                  secondary={
                    qRaw || activeFlag
                      ? undefined
                      : { label: "Install snippet", href: "/portal/connect" }
                  }
                />
              </div>
            ) : (
              <ul className="p-1.5 space-y-0.5">
                {conversations.map((c) => {
                  const firstMessage = firstUserMessage(c.messages);
                  const uniqueFlags = dedupeFlags(c.flags.map((f) => f.flag));
                  const isSelected = validSelectedId === c.id;
                  const href = baseQs
                    ? `/portal/conversations?${baseQs}&c=${c.id}`
                    : `/portal/conversations?c=${c.id}`;
                  return (
                    <li key={c.id}>
                      <Link
                        href={href}
                        className={cn(
                          "flex gap-3 rounded-[10px] px-3 py-2.5 transition-colors",
                          isSelected
                            ? "bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                            : "hover:bg-[var(--t-accent-soft)]",
                        )}
                        aria-current={isSelected ? "true" : undefined}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-[12px] font-semibold text-foreground/70"
                        >
                          {(c.capturedName ?? "?").trim().charAt(0).toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-semibold text-foreground truncate min-w-0 flex-1">
                            {c.capturedName ?? "Anonymous visitor"}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground whitespace-nowrap tabular-nums shrink-0">
                            {formatDistanceToNow(c.lastMessageAt, {
                              addSuffix: false,
                            })}
                          </span>
                        </div>
                        {c.capturedEmail ? (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {c.capturedEmail}
                          </p>
                        ) : null}
                        {firstMessage ? (
                          <p className="text-[11.5px] text-foreground/80 mt-1 line-clamp-2 leading-snug">
                            {firstMessage}
                          </p>
                        ) : c.capturedName || c.capturedEmail ? (
                          <p className="text-[11.5px] text-muted-foreground mt-1 italic line-clamp-1">
                            Pre-chat capture · no message exchange
                          </p>
                        ) : (
                          <p className="text-[11.5px] text-muted-foreground mt-1 italic">
                            No messages
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 flex-wrap min-w-0">
                            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-muted-foreground">
                              {humanChatbotStatus(c.status)}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">
                              · {c.messageCount} msg
                            </span>
                          </div>
                          {uniqueFlags.length > 0 ? (
                            <div className="flex items-center gap-1 shrink-0">
                              {uniqueFlags.slice(0, 2).map((f) => (
                                <FlagPill key={f} flag={f} />
                              ))}
                              {uniqueFlags.length > 2 ? (
                                <span className="ls-eyebrow">
                                  +{uniqueFlags.length - 2}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: transcript pane. On mobile, only renders when a row is
            selected (no point showing a "Select a conversation" panel
            below the list — the operator's intent is the list itself).
            On desktop, always visible so empty state can prompt action. */}
        <div className={cn(
          "flex-col min-h-0 border border-border lg:border-0 overflow-hidden bg-card",
          validSelectedId
            ? "flex rounded-[12px] lg:rounded-none mt-3 lg:mt-0"
            : "hidden lg:flex",
        )}>
          {validSelectedId ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              }
            >
              <InlineTranscript conversationId={validSelectedId} />
            </Suspense>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-secondary/20">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {conversations.length > 0
                  ? "Select a conversation"
                  : "No conversations to review"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {conversations.length > 0
                  ? "Click any row on the left to read the full transcript right here. Bookmark this URL to share the exact view."
                  : "Once visitors start chatting, transcripts will appear here for review."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Returns the first user message's content or null.
function firstUserMessage(raw: Prisma.JsonValue): string | null {
  if (!Array.isArray(raw)) return null;
  for (const m of raw as SerializedMessage[]) {
    if (m && typeof m === "object" && m.role === "user" && typeof m.content === "string") {
      return m.content.trim();
    }
  }
  return null;
}

function dedupeFlags(flags: string[]): FlagType[] {
  const seen = new Set<FlagType>();
  for (const f of flags) {
    if (isFlagType(f)) seen.add(f);
  }
  return FLAG_TYPES.filter((f) => seen.has(f));
}
