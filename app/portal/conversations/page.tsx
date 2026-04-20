import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ChatbotConversationStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { humanChatbotStatus, humanLeadStatus } from "@/lib/format";

export const metadata: Metadata = { title: "Chatbot conversations" };
export const dynamic = "force-dynamic";

export default async function ConversationsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const scope = await requireScope();
  const { status } = await searchParams;

  const where: Prisma.ChatbotConversationWhereInput = { ...tenantWhere(scope) };
  if (status && status in ChatbotConversationStatus) {
    where.status = status as ChatbotConversationStatus;
  }

  const [conversations, counts] = await Promise.all([
    prisma.chatbotConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      include: { lead: { select: { id: true, status: true } } },
    }),
    prisma.chatbotConversation.groupBy({
      by: ["status"],
      where: tenantWhere(scope),
      _count: { _all: true },
    }),
  ]);

  const countsByStatus = new Map<ChatbotConversationStatus, number>();
  for (const row of counts) countsByStatus.set(row.status, row._count._all);
  const totalAll = Array.from(countsByStatus.values()).reduce(
    (a, b) => a + b,
    0
  );
  const leadCaptured =
    countsByStatus.get(ChatbotConversationStatus.LEAD_CAPTURED) ?? 0;
  const active = countsByStatus.get(ChatbotConversationStatus.ACTIVE) ?? 0;
  const handedOff =
    countsByStatus.get(ChatbotConversationStatus.HANDED_OFF) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbot conversations"
        description="Every chat your site has run. Click a row to open the transcript, hand off to your team, or jump to the captured lead."
      />

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
        <StatusLink current={status} value="" label="All" />
        {Object.values(ChatbotConversationStatus).map((s) => (
          <StatusLink
            key={s}
            current={status}
            value={s}
            label={humanChatbotStatus(s)}
          />
        ))}
      </nav>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={totalAll} />
        <StatCard
          label="Lead captured"
          value={leadCaptured}
          tone={leadCaptured > 0 ? "success" : undefined}
        />
        <StatCard label="Active" value={active} />
        <StatCard label="Handed off" value={handedOff} />
      </section>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No conversations match this filter yet.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <Th>Visitor</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Page</Th>
                  <Th className="text-right">Msgs</Th>
                  <Th className="text-right">Last msg</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {conversations.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/portal/conversations/${c.id}`}
                        className="font-medium text-primary hover:underline underline-offset-2"
                      >
                        {c.capturedName ?? "Anonymous"}
                      </Link>
                      {c.lead ? (
                        <div className="text-[11px] text-muted-foreground">
                          Lead: {humanLeadStatus(c.lead.status)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.capturedEmail ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={chatbotStatusTone(c.status)}>
                        {humanChatbotStatus(c.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[24ch]">
                      {c.pageUrl ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                      {c.messageCount}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(c.lastMessageAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function chatbotStatusTone(s: ChatbotConversationStatus) {
  switch (s) {
    case ChatbotConversationStatus.LEAD_CAPTURED:
      return "success" as const;
    case ChatbotConversationStatus.ACTIVE:
      return "info" as const;
    case ChatbotConversationStatus.HANDED_OFF:
      return "warning" as const;
    case ChatbotConversationStatus.ABANDONED:
      return "muted" as const;
    case ChatbotConversationStatus.CLOSED:
    default:
      return "neutral" as const;
  }
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function StatusLink({
  current,
  value,
  label,
}: {
  current: string | undefined;
  value: string;
  label: string;
}) {
  const active = (current ?? "") === value;
  return (
    <Link
      href={
        value
          ? `/portal/conversations?status=${value}`
          : "/portal/conversations"
      }
      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted/50"
      }`}
    >
      {label}
    </Link>
  );
}
