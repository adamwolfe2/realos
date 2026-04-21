import type { Metadata } from "next";
import { Gauge, Phone, MessageSquare, Sparkles, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { CallSheet } from "@/components/portal/briefing/call-sheet";
import { TranscriptList } from "@/components/portal/briefing/transcript-list";
import { SinceBanner } from "@/components/portal/briefing/since-banner";
import { MetricStrip } from "@/components/portal/briefing/metric-strip";
import {
  getBriefingMetrics,
  getCallPriorityLeads,
  getSinceLastViewed,
  getTranscriptsWorthReading,
} from "@/lib/briefing/queries";
import { getRecentInsightsForBriefing } from "@/lib/insights/queries";

export const metadata: Metadata = { title: "Briefing" };
export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const scope = await requireScope();

  const user = await prisma.user.findUnique({
    where: { id: scope.userId },
    select: { lastBriefingViewedAt: true, firstName: true },
  });

  const [
    org,
    delta,
    callLeads,
    transcripts,
    metrics,
    insights,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { name: true },
    }),
    getSinceLastViewed(scope.orgId, user?.lastBriefingViewedAt ?? null),
    getCallPriorityLeads(scope.orgId, 10),
    getTranscriptsWorthReading(scope.orgId, 6),
    getBriefingMetrics(scope.orgId),
    getRecentInsightsForBriefing(scope.orgId, user?.lastBriefingViewedAt ?? null, 8),
  ]);

  const insightCards: InsightCardData[] = insights.map((i) => ({
    id: i.id,
    kind: i.kind,
    category: i.category,
    severity: i.severity,
    status: "open",
    title: i.title,
    body: i.body,
    suggestedAction: i.suggestedAction,
    href: i.href,
    createdAt: i.createdAt,
    property: i.property,
    context: (i.context as Record<string, unknown>) ?? null,
  }));

  const greeting = user?.firstName
    ? `Good morning, ${user.firstName}.`
    : "Good morning.";

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-[var(--stone-gray)]">
          <Gauge className="h-3 w-3" />
          {org?.name ?? "Workspace"}
        </div>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-[var(--near-black)]">
          {greeting}
        </h1>
        <p className="text-sm text-[var(--olive-gray)] mt-1 max-w-2xl">
          Everything that moved since you last looked. Triage the call sheet,
          read the transcripts, and act on the insights before your next client touch.
        </p>
      </header>

      <SinceBanner lastViewedAt={user?.lastBriefingViewedAt ?? null} delta={delta} />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardSection
          eyebrow="Priority calls"
          title="Call sheet"
          description="Ranked by recency, score, and dormancy. Top of the list is who to call first."
          href="/portal/leads"
          hrefLabel="All leads"
          className="lg:col-span-2"
        >
          <CallSheet leads={callLeads} />
        </DashboardSection>

        <div className="space-y-4">
          <DashboardSection
            eyebrow="Momentum"
            title="Last 7 days"
            description="Compared to the prior 7. Deltas tell you where to dig in."
          >
            <MetricStrip metrics={metrics} />
          </DashboardSection>

          <DashboardSection
            eyebrow="Open signals"
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--terracotta)]" />
                Insights
              </span>
            }
            description="Detected anomalies worth a read."
            href="/portal/insights"
            hrefLabel="All insights"
            contentClassName="space-y-2 pt-3"
          >
            {insightCards.length === 0 ? (
              <p className="text-xs text-[var(--stone-gray)]">
                Detectors are quiet this session. Nothing anomalous.
              </p>
            ) : (
              insightCards.slice(0, 4).map((insight) => (
                <InsightCard key={insight.id} insight={insight} dense />
              ))
            )}
          </DashboardSection>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardSection
          eyebrow="Worth reading"
          title={
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-[var(--terracotta)]" />
              Chatbot transcripts
            </span>
          }
          description="Flagged for tuning, captured a lead, or long-form — prioritize these."
          href="/portal/conversations"
          hrefLabel="All conversations"
          className="lg:col-span-2"
        >
          <TranscriptList conversations={transcripts} />
        </DashboardSection>

        <DashboardSection
          eyebrow="What to do next"
          title="Action list"
          description="The practical checklist for this session."
        >
          <ol className="space-y-2 text-sm text-[var(--charcoal-warm)]">
            <ChecklistItem
              icon={Phone}
              label={`Call the top ${Math.min(3, callLeads.length)} lead${callLeads.length === 1 ? "" : "s"} above.`}
              enabled={callLeads.length > 0}
            />
            <ChecklistItem
              icon={Sparkles}
              label="Acknowledge or act on every open insight."
              enabled={insightCards.length > 0}
            />
            <ChecklistItem
              icon={MessageSquare}
              label="Skim the flagged transcripts, tune the bot prompt if needed."
              enabled={transcripts.length > 0}
            />
            <ChecklistItem
              icon={TrendingUp}
              label="Review the metric strip. Any red cell is a conversation starter."
              enabled
            />
          </ol>
        </DashboardSection>
      </section>
    </div>
  );
}

function ChecklistItem({
  icon: Icon,
  label,
  enabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  enabled: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
          enabled
            ? "bg-[var(--terracotta)]/10 text-[var(--terracotta)]"
            : "bg-[var(--warm-sand)] text-[var(--stone-gray)]"
        }`}
      >
        <Icon className="h-3 w-3" />
      </span>
      <span className={enabled ? "" : "text-[var(--stone-gray)]"}>{label}</span>
    </li>
  );
}
