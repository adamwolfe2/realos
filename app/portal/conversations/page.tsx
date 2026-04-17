import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ChatbotConversationStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/admin/stat-card";

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
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Chatbot conversations</h1>
          <p className="text-sm opacity-60 mt-1">
            Every chat your site has run. Click a row to open the transcript,
            hand off to your team, or jump to the captured lead.
          </p>
        </div>
        <nav className="flex gap-1 text-xs">
          <StatusLink current={status} value="" label="All" />
          {Object.values(ChatbotConversationStatus).map((s) => (
            <StatusLink key={s} current={status} value={s} label={s} />
          ))}
        </nav>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <p className="text-sm opacity-60 border rounded-md p-6">
          No conversations match this filter yet.
        </p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase opacity-60">
              <tr>
                <th className="text-left px-4 py-2">Visitor</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Page</th>
                <th className="text-right px-4 py-2">Msgs</th>
                <th className="text-right px-4 py-2">Last msg</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {conversations.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link
                      href={`/portal/conversations/${c.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {c.capturedName ?? "Anonymous"}
                    </Link>
                    {c.lead ? (
                      <div className="text-[11px] opacity-60">
                        Lead: {c.lead.status}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {c.capturedEmail ?? (
                      <span className="opacity-60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">{c.status}</td>
                  <td className="px-4 py-2 text-xs opacity-80 truncate max-w-[24ch]">
                    {c.pageUrl ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.messageCount}
                  </td>
                  <td className="px-4 py-2 text-right text-xs opacity-60 whitespace-nowrap">
                    {formatDistanceToNow(c.lastMessageAt, { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
      className={`px-2 py-1 border rounded ${
        active ? "bg-foreground text-background" : ""
      }`}
    >
      {label}
    </Link>
  );
}
