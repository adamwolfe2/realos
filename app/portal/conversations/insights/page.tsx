import type { Metadata } from "next";
import Link from "next/link";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { parsePropertyFilter, propertyWhereFragment } from "@/lib/tenancy/property-filter";
import { getChatbotAnalytics } from "@/lib/chatbot/conversation-analytics";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { MessageSquare, TrendingUp, UserCheck, Wrench, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chatbot insights" };
export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

export default async function ChatbotInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; property?: string; properties?: string }>;
}) {
  const gate = await requireModule("moduleConversations");
  if (gate) return gate;

  const scope = await requireScope();
  const sp = await searchParams;
  const propertyIds = await parsePropertyFilter(sp, scope.orgId);
  const periodDays = PERIODS.some((p) => String(p.days) === sp.days)
    ? Number(sp.days)
    : 30;

  const analytics = await getChatbotAnalytics({
    orgId: scope.orgId,
    propertyWhere: propertyWhereFragment(scope, propertyIds),
    periodDays,
  });

  const { totals, trend, topKeywords, topQuestions } = analytics;
  const dailyConversations = trend.map((t) => t.conversations);
  const maxKeyword = topKeywords[0]?.count ?? 1;
  const maxQuestion = topQuestions[0]?.count ?? 1;
  const hasData = totals.conversations > 0;

  const periodQS = (days: number) => {
    const params = new URLSearchParams();
    params.set("days", String(days));
    if (sp.property) params.set("property", sp.property);
    if (sp.properties) params.set("properties", sp.properties);
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbot insights"
        description="What prospects are asking, capture-rate trends, and the topics that come up most — the signal behind the transcripts."
        actions={
          <Link
            href="/portal/conversations"
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            ← All conversations
          </Link>
        }
      />

      {/* Period selector */}
      <div className="flex items-center gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={periodQS(p.days)}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-inset transition",
              p.days === periodDays
                ? "bg-primary text-white ring-primary"
                : "bg-white text-muted-foreground ring-border hover:ring-primary/40",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Top-line metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Conversations"
          value={totals.conversations.toLocaleString()}
          hint={`${totals.lifetimeConversations.toLocaleString()} all-time`}
          spark={dailyConversations}
          chart="bars"
          icon={<MessageSquare className="h-4 w-4" />}
          variant="accent"
        />
        <KpiTile
          label="Capture rate"
          value={`${totals.captureRatePct}%`}
          hint={`${totals.leadsCaptured.toLocaleString()} leads captured`}
          gaugeValue={totals.captureRatePct / 100}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <KpiTile
          label="Avg. messages"
          value={totals.avgMessages.toString()}
          hint="per conversation"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiTile
          label="Needs prompt tuning"
          value={totals.needsTuning.toLocaleString()}
          hint="flagged conversations"
          href="/portal/conversations?flag=needs_prompt_tuning"
          icon={<Wrench className="h-4 w-4" />}
        />
      </div>

      {!hasData ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="No conversations in this window"
          body="Once prospects start chatting with your bot, their questions and trends show up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top questions */}
          <section className="ls-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[13px] font-semibold text-foreground">
                Most-asked questions
              </h2>
            </div>
            {topQuestions.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                Not enough opening questions yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {topQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="ls-metric mt-0.5 w-5 shrink-0 text-[12px] text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-foreground" title={q.question}>
                        {q.question}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(6, (q.count / maxQuestion) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="ls-metric shrink-0 text-[12px] text-muted-foreground">
                      {q.count}×
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Top keywords */}
          <section className="ls-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[13px] font-semibold text-foreground">
                Common keywords
              </h2>
            </div>
            {topKeywords.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                Not enough message text yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {topKeywords.map((k) => (
                  <li key={k.term} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-[13px] text-foreground" title={k.term}>
                      {k.term}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{ width: `${Math.max(4, (k.count / maxKeyword) * 100)}%` }}
                      />
                    </div>
                    <span className="ls-metric w-8 shrink-0 text-right text-[12px] text-muted-foreground">
                      {k.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
