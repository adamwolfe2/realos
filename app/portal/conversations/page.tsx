import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  isAccessDenied,
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { ChatbotConversationStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { humanChatbotStatus } from "@/lib/format";
import {
  FlagPill,
  FLAG_TYPES,
  isFlagType,
  type FlagType,
} from "@/components/portal/conversations/flag-pill";
import { MessageSquare } from "lucide-react";
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
  const scope = await requireScope();
  const sp = await searchParams;
  const propertyIds = parsePropertyFilter(sp);

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

  const [totalConversations, flagCounts, qualityBadCount] = await Promise.all([
    prisma.chatbotConversation.count({ where: { ...tenantWhere(scope) } }),
    prisma.conversationFlag.groupBy({
      by: ["flag"],
      where: { orgId: scope.orgId },
      _count: { conversationId: true },
    }),
    prisma.conversationFlag.count({
      where: { orgId: scope.orgId, flag: "quality_bad" },
    }),
  ]);

  const flagCountMap = new Map<string, number>();
  for (const row of flagCounts) {
    flagCountMap.set(row.flag, row._count.conversationId);
  }

  const filterChips = [
    { key: "", label: "All", count: totalConversations },
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

  const activeFlag: FlagType | null =
    flagParam && isFlagType(flagParam) ? flagParam : null;

  const where: Prisma.ChatbotConversationWhereInput = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(scope, propertyIds),
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
  const validSelectedId =
    selectedId && /^[a-zA-Z0-9_-]+$/.test(selectedId) ? selectedId : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader
        title="Chatbot conversations"
        description="Read transcripts inline, flag patterns to tune the system prompt, and find leads worth chasing. Filters are URL-driven."
        actions={
          <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
        }
      />

      {isAccessDenied(scope, propertyIds) ? (
        <PropertyAccessDeniedBanner pathname="/portal/conversations" />
      ) : null}

      {/* 2-pane container */}
      <div className="flex-1 min-h-0 mt-3 grid grid-cols-1 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] gap-3 lg:gap-0">
        {/* LEFT: list pane */}
        <div className="flex flex-col min-h-0 lg:border lg:border-border lg:border-r-0 lg:rounded-l-lg overflow-hidden bg-card">
          <div className="px-3 py-3 border-b border-border bg-card shrink-0">
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
              <ul className="divide-y divide-border">
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
                          "block px-3.5 py-3 transition-colors border-l-2",
                          isSelected
                            ? "bg-primary/5 border-primary"
                            : "border-transparent hover:bg-muted/50",
                        )}
                        aria-current={isSelected ? "true" : undefined}
                      >
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
                                <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest">
                                  +{uniqueFlags.length - 2}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
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
          "flex-col min-h-0 border border-border lg:rounded-r-lg overflow-hidden bg-card",
          validSelectedId
            ? "flex rounded-lg mt-3 lg:mt-0"
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
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-secondary/20">
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
