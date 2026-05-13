import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { ChatbotConversationStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ChatbotConversationStatus, string> = {
  ACTIVE: "bg-primary/5 text-primary",
  LEAD_CAPTURED: "bg-sky-50 text-sky-700",
  ABANDONED: "bg-foreground/10 text-foreground",
  HANDED_OFF: "bg-muted/40 text-foreground",
  CLOSED: "bg-foreground/10 text-foreground",
};

export default async function SupportPage() {
  await requireAgency();

  const liveSince = new Date(Date.now() - 5 * 60 * 1000);

  const [liveConversations, recentEngagements, recentConversations] =
    await Promise.all([
      prisma.chatbotConversation.findMany({
        where: { lastMessageAt: { gte: liveSince } },
        orderBy: { lastMessageAt: "desc" },
        include: { org: { select: { name: true, slug: true, id: true } } },
        take: 25,
      }),
      prisma.chatbotEngagement.findMany({
        orderBy: { createdAt: "desc" },
        include: { org: { select: { name: true, slug: true } } },
        take: 25,
      }),
      prisma.chatbotConversation.findMany({
        orderBy: { lastMessageAt: "desc" },
        include: {
          org: { select: { name: true, slug: true, id: true } },
        },
        take: 50,
      }),
    ]);

  const totalActive = await prisma.chatbotConversation.count({
    where: { status: ChatbotConversationStatus.ACTIVE },
  });
  const totalHandedOff = await prisma.chatbotConversation.count({
    where: { status: ChatbotConversationStatus.HANDED_OFF },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Cross-tenant view of chatbot conversations and operator-triggered engagements. Agency-side support inbox is a follow-up."
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Live now" value={liveConversations.length.toString()} hint="last 5 min" />
        <Stat label="Active" value={totalActive.toString()} hint="all-time" />
        <Stat label="Handed off" value={totalHandedOff.toString()} hint="awaiting human" />
        <Stat
          label="Engagements (7d)"
          value={recentEngagements
            .filter(
              (e) =>
                e.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            )
            .length.toString()}
          hint="operator-triggered"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Live conversations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active in the last 5 minutes
            </p>
          </div>
          {liveConversations.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No live chats right now.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {liveConversations.map((c) => (
                <li key={c.id} className="px-4 py-3 hover:bg-muted/20">
                  <Link
                    href={`/admin/clients/${c.org.id}`}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.capturedName ?? "Anonymous visitor"}
                        {c.capturedEmail && (
                          <span className="text-xs text-muted-foreground ml-2 font-normal">
                            {c.capturedEmail}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.org.name} • {c.messageCount} message
                        {c.messageCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_TONE[c.status]}`}
                      >
                        {c.status.toLowerCase().replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(c.lastMessageAt, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Recent engagements</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operator-triggered nudges to live visitors
            </p>
          </div>
          {recentEngagements.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No engagements yet. Operators can engage live chats from
              /portal/visitors.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentEngagements.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{e.message}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.org.name}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] uppercase tracking-wide bg-foreground/10 px-1.5 py-0.5 rounded">
                        {e.status.toLowerCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">All recent conversations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 50 across every tenant
          </p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Visitor</th>
              <th className="px-4 py-3 text-left font-medium">Tenant</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Messages</th>
              <th className="px-4 py-3 text-right font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentConversations.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {c.capturedName ?? "Anonymous visitor"}
                  </div>
                  {c.capturedEmail && (
                    <div className="text-xs text-muted-foreground">
                      {c.capturedEmail}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/clients/${c.org.id}`}
                    className="hover:underline"
                  >
                    {c.org.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_TONE[c.status]}`}
                  >
                    {c.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.messageCount}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {formatDistanceToNow(c.lastMessageAt, { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {hint && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}
