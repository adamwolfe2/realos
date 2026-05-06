import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  parsePropertyFilter,
  propertyWhereFragment,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
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
import {
  TranscriptSearch,
  type SortOption,
} from "./transcript-search";

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
// Server component. Reads URL params, builds the Prisma where clause, and
// returns the filtered list plus per-chip counts. Heavy-lifting query stays
// here so the TranscriptSearch client only handles inputs / URL state.
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
  }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const propertyIds = parsePropertyFilter(sp);

  // Property list for the dropdown — fetched once per render alongside
  // the rest of the page data.
  const properties = await prisma.property.findMany({
    where: { orgId: scope.orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const qRaw = (sp.q ?? "").trim();
  const flagParam = (sp.flag ?? "").trim();
  const sort: SortValue = isSort(sp.sort) ? sp.sort : "newest";
  const statusParam = sp.status && sp.status in ChatbotConversationStatus
    ? (sp.status as ChatbotConversationStatus)
    : undefined;

  // If the operator typed a query, find matching conversation IDs via raw
  // SQL over the JSON messages column. ILIKE keeps the search case-insensitive
  // and `::text` coerces the jsonb to a searchable string. Capped to 500 rows
  // so a broad query can't punish the page.
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

  // Chip counts: one query that groups by flag type. "All" is the total
  // conversation count; flag-specific chips count conversations that have at
  // least one matching flag row. "Missed handoffs" currently maps to the
  // `handoff_missed` flag since that's the operator's explicit annotation.
  const [totalConversations, flagCounts, qualityBadCount] = await Promise.all([
    prisma.chatbotConversation.count({ where: { ...tenantWhere(scope) } }),
    prisma.conversationFlag.groupBy({
      by: ["flag"],
      where: { orgId: scope.orgId },
      _count: { conversationId: true },
    }),
    // quality_bad is listed separately so the chip reads as "Flagged bad
    // quality" even though it's the same flag type column internally.
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

  // Build the main list query. The filter chip lines up one-to-one with a
  // flag type; we use a `some` relation filter so rows with the flag are
  // included and nothing else is. Message search is applied by filtering to
  // the IDs we pulled in the raw query above.
  const activeFlag: FlagType | null =
    flagParam && isFlagType(flagParam) ? flagParam : null;

  const where: Prisma.ChatbotConversationWhereInput = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(propertyIds),
  };
  if (statusParam) where.status = statusParam;
  if (activeFlag) where.flags = { some: { flag: activeFlag } };
  if (messageMatchIds) {
    if (messageMatchIds.size === 0) {
      // No matches — short-circuit with an ID that won't exist.
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

  return (
    <div className="space-y-3">
      <PageHeader
        title="Chatbot conversations"
        description="Read every transcript, flag patterns to tune the system prompt, and find the leads worth chasing. Filters are URL-driven so you can bookmark or share a view."
        actions={
          <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
        }
      />

      <Suspense>
        <TranscriptSearch
          filters={filterChips}
          initialQuery={qRaw}
          initialFilter={flagParam}
          initialSort={sort}
        />
      </Suspense>

      <p className="text-xs text-muted-foreground">
        Showing {conversations.length} of {totalConversations} conversations
        {qRaw ? (
          <>
            {" "}matching <span className="font-semibold text-foreground">{qRaw}</span>
          </>
        ) : null}
        .
      </p>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations match this view yet."
          body={
            qRaw || activeFlag
              ? "Try clearing your search or filter."
              : "When visitors chat with your bot, transcripts land here. Make sure the embed snippet is on the property site."
          }
        />
      ) : (
        <ul className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          {conversations.map((c) => {
            const firstMessage = firstUserMessage(c.messages);
            const uniqueFlags = dedupeFlags(c.flags.map((f) => f.flag));
            return (
              <li key={c.id}>
                <Link
                  href={`/portal/conversations/${c.id}`}
                  className="group block px-4 py-3 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {c.capturedName ?? "Anonymous visitor"}
                        </span>
                        {c.capturedEmail ? (
                          <span className="text-xs text-muted-foreground truncate">
                            {c.capturedEmail}
                          </span>
                        ) : null}
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {humanChatbotStatus(c.status)}
                        </span>
                      </div>
                      {firstMessage ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {truncate(firstMessage, 80)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          No user messages yet.
                        </p>
                      )}
                      {uniqueFlags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {uniqueFlags.slice(0, 4).map((f) => (
                            <FlagPill key={f} flag={f} />
                          ))}
                          {uniqueFlags.length > 4 ? (
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest self-center">
                              +{uniqueFlags.length - 4}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {c.messageCount}
                        <span className="text-[10px] text-muted-foreground ml-1 font-normal">
                          msgs
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
                        {formatDistanceToNow(c.lastMessageAt, {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Returns the first user message's content or null. Messages JSON is untyped,
// so we guard every lookup.
function firstUserMessage(raw: Prisma.JsonValue): string | null {
  if (!Array.isArray(raw)) return null;
  for (const m of raw as SerializedMessage[]) {
    if (m && typeof m === "object" && m.role === "user" && typeof m.content === "string") {
      return m.content.trim();
    }
  }
  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "\u2026";
}

function dedupeFlags(flags: string[]): FlagType[] {
  const seen = new Set<FlagType>();
  for (const f of flags) {
    if (isFlagType(f)) seen.add(f);
  }
  // Preserve canonical order so pill lineups look stable.
  return FLAG_TYPES.filter((f) => seen.has(f));
}
