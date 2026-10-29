import type { Metadata } from "next";
import Link from "next/link";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import {
  effectivePropertyIds,
  marketableScopedPropertyClause,
  parsePropertyFilter,
} from "@/lib/tenancy/property-filter";
import { getChatbotAnalytics } from "@/lib/chatbot/conversation-analytics";
import { loadChatbotLearningSummary } from "@/lib/chatbot/learning/run";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Lightbulb,
  ListChecks,
  Wrench,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { SourceMark } from "@/components/portal/source-mark";
import { Logo } from "@/components/portal/overview/kit";
import { loadFixEvidence, type FixEvidence } from "@/lib/chatbot/learning/evidence";
import { loadFixImpact, type FixImpact } from "@/lib/chatbot/learning/impact";
import { cn } from "@/lib/utils";
import { patternTitle } from "@/lib/chatbot/learning/pattern-labels";
import { RunLearningButton } from "./run-learning-button";
import { RecommendationActions } from "./recommendation-actions";
import { barPct } from "@/lib/charts/bar-width";

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
  const effectiveIds = effectivePropertyIds(scope, propertyIds);
  const periodDays = PERIODS.some((p) => String(p.days) === sp.days)
    ? Number(sp.days)
    : 30;

  const [analytics, learning] = await Promise.all([
    getChatbotAnalytics({
      orgId: scope.orgId,
      propertyWhere: await marketableScopedPropertyClause(
        scope,
        propertyIds,
        "propertyId",
        { defaultIncludesOrgRows: true },
      ),
      periodDays,
    }),
    loadChatbotLearningSummary({
      orgId: scope.orgId,
      propertyIds: effectiveIds,
    }),
  ]);

  const { totals, topKeywords, topQuestions } = analytics;
  const maxKeyword = topKeywords[0]?.count ?? 1;
  const maxQuestion = topQuestions[0]?.count ?? 1;
  const hasData = totals.conversations > 0;
  const latestRun = learning.latestRun;
  const latestRunLabel = latestRun
    ? formatDistanceToNowStrict(latestRun.startedAt)
    : "Not run yet";
  const latestRunHint = latestRun
    ? `ago · ${latestRun.status}${latestRun.recordsProcessed == null ? "" : ` · ${latestRun.recordsProcessed.toLocaleString()} records`}`
    : "Daily automation is scheduled";

  const periodQS = (days: number) => {
    const params = new URLSearchParams();
    params.set("days", String(days));
    if (sp.property) params.set("property", sp.property);
    if (sp.properties) params.set("properties", sp.properties);
    return `?${params.toString()}`;
  };

  // The real conversations behind each fix (first two source chats each).
  const evidenceIds = [
    ...learning.knowledgeSuggestions.flatMap((k) => k.sourceCaseIds.slice(0, 2)),
    ...learning.siteRecommendations.flatMap((r) => r.insight?.sourceCaseIds.slice(0, 2) ?? []),
  ];
  const evidence = await loadFixEvidence(scope.orgId, evidenceIds).catch((err: unknown) => {
    console.error("[portal/conversations/insights] evidence load failed:", err);
    return new Map<string, FixEvidence>();
  });
  const evidenceFor = (ids: string[] | undefined) =>
    (ids ?? []).slice(0, 2).map((id) => evidence.get(id)).filter((e): e is FixEvidence => Boolean(e));

  // Before/after for live fixes, measured only up to the last learning run
  // (newer chats are not classified yet).
  const impact = await loadFixImpact(
    scope.orgId,
    learning.appliedKnowledge,
    latestRun?.finishedAt ?? latestRun?.startedAt ?? new Date(),
  ).catch((err: unknown) => {
    console.error("[portal/conversations/insights] impact load failed:", err);
    return new Map<string, FixImpact>();
  });

  const c = learning.counts;
  const queueCount =
    c.openKnowledgeSuggestions + c.openSiteRecommendations + c.openTasks + c.openInsights;
  const headline: Array<{ value: string; label: string; href?: string }> = [
    { value: queueCount.toLocaleString(), label: queueCount === 1 ? "fix waiting" : "fixes waiting" },
    { value: c.appliedLast30d.toLocaleString(), label: "applied this month" },
    { value: totals.conversations.toLocaleString(), label: `chats in ${periodDays}d` },
    { value: `${totals.captureRatePct}%`, label: "capture rate" },
    { value: totals.avgMessages.toString(), label: "msgs per chat" },
  ];
  if (totals.needsTuning > 0) {
    headline.push({
      value: totals.needsTuning.toLocaleString(),
      label: "need prompt tuning",
      href: "/portal/conversations?flag=needs_prompt_tuning",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Suggested fixes</h1>
          <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
            {headline.map((st, i) => {
              const body = (
                <>
                  <span className="font-medium text-foreground">{st.value}</span> {st.label}
                </>
              );
              return (
                <span key={st.label}>
                  {i > 0 ? " · " : null}
                  {st.href ? (
                    <Link href={st.href} className="hover:text-primary">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </span>
              );
            })}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <RefreshStatusIcon status={latestRun?.status ?? null} />
            {latestRun ? `Learned ${latestRunLabel} ${latestRunHint}` : "No learning pass yet · runs daily"}
            {" · "}Approval on, nothing sends on its own
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-secondary p-0.5">
            {PERIODS.map((p) => (
              <Link
                key={p.days}
                href={periodQS(p.days)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                  p.days === periodDays
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(11,21,48,0.08)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <RunLearningButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
        {/* The queue: every drafted fix in one list, grouped by kind. */}
        <section className="ls-card overflow-hidden">
          {queueCount === 0 ? (
            <div className="p-10 text-center">
              <Lightbulb className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-2 text-[14px] font-medium text-foreground">Nothing waiting</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                The agent drafts fixes from new conversations after each learning pass.
              </p>
            </div>
          ) : (
            <>
              <QueueGroup title="Chatbot answers" icon={<Wrench className="h-3.5 w-3.5" />} count={c.openKnowledgeSuggestions}>
                {learning.knowledgeSuggestions.map((sg) => (
                  <QueueRow
                    key={sg.id}
                    marks={<SourceMark source="CHATBOT" size={22} />}
                    meta={`${patternTitle(sg.patternType)} · learned from ${sg.affectedCount} chats`}
                    body={sg.suggestedText}
                    evidence={evidenceFor(sg.sourceCaseIds)}
                    actions={<RecommendationActions id={sg.id} kind="knowledge" />}
                  />
                ))}
              </QueueGroup>
              <QueueGroup title="Website" icon={<AlertTriangle className="h-3.5 w-3.5" />} count={c.openSiteRecommendations}>
                {learning.siteRecommendations.map((rec) => (
                  <QueueRow
                    key={rec.id}
                    marks={<SiteRecMarks fromChats={Boolean(rec.insightId)} body={rec.suggestedBody} />}
                    title={rec.suggestedTitle}
                    body={rec.suggestedBody}
                    evidence={evidenceFor(rec.insight?.sourceCaseIds)}
                    actions={<RecommendationActions id={rec.id} kind="site" />}
                  />
                ))}
              </QueueGroup>
              <QueueGroup title="Objections" icon={<Lightbulb className="h-3.5 w-3.5" />} count={c.openInsights}>
                {learning.topInsights.map((insight) => (
                  <QueueRow
                    key={insight.id}
                    title={insight.title}
                    meta={`${insight.affectedCount} chats`}
                    body={insight.summary}
                    actions={<RecommendationActions id={insight.id} kind="insight" />}
                  />
                ))}
              </QueueGroup>
              <QueueGroup title="Follow-ups" icon={<ListChecks className="h-3.5 w-3.5" />} count={c.openTasks}>
                {learning.recentTasks.map((task) => (
                  <QueueRow
                    key={task.id}
                    title={[task.lead?.firstName, task.lead?.lastName].filter(Boolean).join(" ") || "Lead"}
                    meta={`P${task.priority}`}
                    body={task.reasonSummary}
                    actions={
                      task.leadId ? (
                        <Link
                          href={`/portal/leads/${task.leadId}`}
                          className="text-[12px] font-medium text-primary hover:underline"
                        >
                          Review draft
                        </Link>
                      ) : null
                    }
                  />
                ))}
              </QueueGroup>
            </>
          )}
        </section>

        {/* Self-healing record: fixes already live in the chatbot. */}
        {learning.appliedKnowledge.length > 0 ? (
          <section className="ls-card overflow-hidden">
            <div className="flex items-center gap-2 bg-[var(--t-wash)] px-5 py-2.5 text-[12px] font-medium text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16a34a]" />
              Fixed and live in the chatbot
              <span className="tabular-nums">{c.appliedLast30d} this month</span>
            </div>
            <ul className="divide-y divide-border">
              {learning.appliedKnowledge.map((k) => (
                <li key={k.id} className="flex items-start gap-3 px-5 py-3">
                  <SourceMark source="CHATBOT" size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground">{k.suggestedText}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {k.appliedAt ? `Applied ${format(k.appliedAt, "MMM d")} · ` : ""}learned from {k.affectedCount} chats
                    </p>
                    <ImpactLine impact={impact.get(k.id)} appliedAt={k.appliedAt} />
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-[#15803d]">Live</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        </div>

        {/* What renters ask: the raw signal the fixes are drafted from. */}
        <aside className="space-y-6">
          <section>
            <h2 className="text-[13px] font-semibold text-foreground">What renters ask</h2>
            {!hasData || topQuestions.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Not enough conversations in this window yet.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {topQuestions.map((q, i) => (
                  <li key={i}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[13px] text-foreground" title={q.question}>
                        {q.question}
                      </p>
                      <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">{q.count}×</span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${barPct(q.count, maxQuestion, 6)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {hasData && topKeywords.length > 0 ? (
            <section>
              <h2 className="text-[13px] font-semibold text-foreground">Common words</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topKeywords.map((k) => (
                  <span
                    key={k.term}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--t-accent-soft)] px-2.5 py-1 text-[12px] text-foreground"
                    style={{ opacity: 0.55 + 0.45 * (k.count / maxKeyword) }}
                  >
                    {k.term}
                    <span className="text-muted-foreground tabular-nums">{k.count}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function QueueGroup({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 bg-[var(--t-wash)] px-5 py-2.5 text-[12px] font-medium text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {title}
        <span className="tabular-nums">{count}</span>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function QueueRow({
  title,
  meta,
  body,
  actions,
  marks,
  evidence = [],
}: {
  title?: string;
  meta?: string;
  body: string;
  actions?: React.ReactNode;
  marks?: React.ReactNode;
  evidence?: FixEvidence[];
}) {
  return (
    <li className="flex gap-3 px-5 py-4">
      <div className="flex shrink-0 flex-col gap-1 pt-0.5">{marks}</div>
      <div className="min-w-0 flex-1">
        {meta ? <p className="text-[12px] text-muted-foreground">{meta}</p> : null}
        {title ? <p className="text-[13px] font-semibold text-foreground">{title}</p> : null}
        <p className="mt-0.5 text-[13px] leading-5 text-foreground">{body}</p>
        {evidence.length > 0 ? (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {evidence.map((e) => (
              <Link
                key={e.conversationId}
                href={`/portal/conversations?c=${e.conversationId}`}
                className="block rounded-[10px] border border-border bg-[var(--t-wash)] p-3 hover:border-[var(--t-accent)]"
              >
                <p className="text-[11.5px] text-muted-foreground">
                  {e.visitorName ?? "Visitor"}
                  {e.propertyName ? ` · ${e.propertyName}` : ""}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-snug text-foreground line-clamp-2">
                  &ldquo;{e.question}&rdquo;
                </p>
                {e.reply ? (
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground line-clamp-2">
                    Bot: {e.reply}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[11.5px] font-medium text-primary">Open chat →</p>
              </Link>
            ))}
          </div>
        ) : null}
        {actions ? <div className="mt-3">{actions}</div> : null}
      </div>
    </li>
  );
}

// Where a website recommendation's signal came from. Recommendations have
// no source column, so analytics sources are read from the evidence text.
// ponytail: text match on "GA4"/"Search Console"; add a source field to
// SiteImprovementRecommendation if this ever mislabels.
function SiteRecMarks({ fromChats, body }: { fromChats: boolean; body: string }) {
  const tile = "grid h-[22px] w-[22px] place-items-center rounded-[6px] border border-border bg-white";
  return (
    <>
      {fromChats ? <SourceMark source="CHATBOT" size={22} /> : null}
      {/\bGA4\b|Google Analytics/i.test(body) ? (
        <span className={tile}><Logo slug="ga4" size={13} /></span>
      ) : null}
      {/Search Console|\bGSC\b/i.test(body) ? (
        <span className={tile}><Logo slug="gsc" size={13} /></span>
      ) : null}
    </>
  );
}

function RefreshStatusIcon({ status }: { status: string | null }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "partial" || status === "error") {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  }
  return <Clock3 className="h-3.5 w-3.5" />;
}

function ImpactLine({ impact, appliedAt }: { impact: FixImpact | undefined; appliedAt: Date | null }) {
  if (!impact) return null;
  if (impact.kind === "too_early") {
    return (
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        Too early to tell · live {impact.daysLive} {impact.daysLive === 1 ? "day" : "days"}, measuring after 7
      </p>
    );
  }
  const { before, after, days, chatsBefore, chatsAfter, label } = impact;
  const better = after < before;
  const worse = after > before;
  const changePct = before > 0 ? Math.round(((after - before) / before) * 100) : null;
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold tabular-nums text-foreground">
        {before} → {after}
      </span>
      {changePct != null && changePct !== 0 ? (
        <span className={cn("font-medium tabular-nums", better ? "text-[#15803d]" : "text-[#b45309]")}>
          {changePct > 0 ? "+" : ""}
          {changePct}%
        </span>
      ) : null}
      <span className="text-muted-foreground tabular-nums">
        {days}d before vs {days}d since{appliedAt ? ` ${format(appliedAt, "MMM d")}` : ""} · {chatsBefore} → {chatsAfter} chats
        {!better && !worse ? " · no change yet" : ""}
      </span>
    </div>
  );
}
