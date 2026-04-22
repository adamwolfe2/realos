import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { getPropertyChatbot } from "@/lib/properties/queries";

export async function ChatbotTab({
  orgId,
  propertyId,
  propertyName,
}: {
  orgId: string;
  propertyId: string;
  propertyName: string;
}) {
  const data = await getPropertyChatbot(orgId, propertyId, propertyName);

  const emptyEverything =
    data.totalConversations === 0 &&
    data.capturedLeads === 0 &&
    data.recent.length === 0 &&
    data.topTopics.length === 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Conversations"
          value={data.totalConversations}
          hint="Linked to this property"
        />
        <KpiTile
          label="Captured leads"
          value={data.capturedLeads}
          hint="Email provided"
        />
        <KpiTile
          label="Recent threads"
          value={data.recent.length}
          hint="Latest 10 scanned"
        />
        <KpiTile
          label="Top terms"
          value={data.topTopics.length}
          hint="Filtered stopwords"
        />
      </section>

      {emptyEverything ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">
            No chatbot activity yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Once visitors start chatting about this property, conversations and
            top topics will surface here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardSection
            title="Most-asked topics"
            eyebrow="From user messages"
            description="Top terms after stopword filtering"
          >
            {data.topTopics.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No user messages yet.
              </p>
            ) : (
              <ol className="space-y-2">
                {data.topTopics.map((t, i) => {
                  const max = data.topTopics[0]?.count || 1;
                  const width = Math.max(6, Math.round((t.count / max) * 100));
                  return (
                    <li
                      key={t.term}
                      className="grid grid-cols-[20px_1fr_40px] items-center gap-2 text-xs"
                    >
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <span className="relative h-5 rounded-md bg-muted/60 overflow-hidden">
                        <span
                          className="absolute left-0 top-0 h-full bg-primary/80"
                          style={{ width: `${width}%` }}
                        />
                        <span className="relative px-2 leading-5 text-foreground">
                          {t.term}
                        </span>
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground">
                        {t.count}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </DashboardSection>

          <DashboardSection
            title="Recent transcripts"
            eyebrow="Latest 10"
            href="/portal/conversations"
            hrefLabel="All conversations"
          >
            {data.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No conversations yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recent.map((c) => {
                  const name =
                    c.capturedName ||
                    c.capturedEmail ||
                    "Anonymous visitor";
                  return (
                    <li key={c.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link
                        href={`/portal/conversations/${c.id}`}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {name}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {c.messageCount} messages{" "}
                            {c.status ? `\u00b7 ${c.status}` : ""}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(c.lastMessageAt, {
                            addSuffix: true,
                          })}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardSection>
        </div>
      )}
    </div>
  );
}
