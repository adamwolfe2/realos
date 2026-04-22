import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Phone, MessageSquare, Sparkles, TrendingUp, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const scope = await requireScope();
  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: scope.userId },
    select: { lastBriefingViewedAt: true, firstName: true },
  });

  const properties = await prisma.property.findMany({
    where: { orgId: scope.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Validate the requested property belongs to the tenant. Falls back silently
  // if the param points somewhere else.
  const activePropertyId =
    params.property && properties.some((p) => p.id === params.property)
      ? params.property
      : null;
  const activeProperty = activePropertyId
    ? properties.find((p) => p.id === activePropertyId) ?? null
    : null;

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
    getCallPriorityLeads(scope.orgId, { limit: 10, propertyId: activePropertyId }),
    getTranscriptsWorthReading(scope.orgId, { limit: 6, propertyId: activePropertyId }),
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

  const greeting = "Daily briefing";

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            <Gauge className="h-3 w-3" />
            {org?.name ?? "Workspace"}
            {activeProperty ? (
              <>
                <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
                <span className="text-primary">{activeProperty.name}</span>
              </>
            ) : null}
          </div>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Everything that moved since you last looked. Triage the call sheet,
            read the transcripts, and act on the insights before your next client touch.
          </p>
        </div>
        {properties.length > 1 ? (
          <PropertyFilter
            properties={properties}
            activeId={activePropertyId}
          />
        ) : null}
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
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Insights
              </span>
            }
            description="Detected anomalies worth a read."
            href="/portal/insights"
            hrefLabel="All insights"
            contentClassName="space-y-2 pt-3"
          >
            {insightCards.length === 0 ? (
              <p className="text-xs text-muted-foreground">
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
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
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
          <ol className="space-y-2 text-sm text-foreground">
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

function PropertyFilter({
  properties,
  activeId,
}: {
  properties: { id: string; name: string }[];
  activeId: string | null;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2">
        <Building2 className="h-3 w-3" />
        Focus
      </span>
      <Link
        href="/portal/briefing"
        className={cn(
          "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
          !activeId
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        All
      </Link>
      {properties.map((p) => {
        const active = activeId === p.id;
        return (
          <Link
            key={p.id}
            href={`/portal/briefing?property=${p.id}`}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors truncate max-w-[14rem]",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {p.name}
          </Link>
        );
      })}
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
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-3 w-3" />
      </span>
      <span className={enabled ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
