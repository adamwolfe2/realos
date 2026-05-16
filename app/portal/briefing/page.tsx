import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Phone, MessageSquare, Sparkles, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
// Removed Building2 + cn imports — only the deleted PropertyFilter
// component used them.
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { CallSheet } from "@/components/portal/briefing/call-sheet";
import { TranscriptList } from "@/components/portal/briefing/transcript-list";
import { SinceBanner } from "@/components/portal/briefing/since-banner";
import { MetricStrip } from "@/components/portal/briefing/metric-strip";
import {
  getBriefingMetrics,
  getCallPriorityLeads,
  getAgingLeadsSummary,
  getSinceLastViewed,
  getTranscriptsWorthReading,
} from "@/lib/briefing/queries";
import { getRecentInsightsForBriefing } from "@/lib/insights/queries";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Briefing" };
export const dynamic = "force-dynamic";

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; properties?: string }>;
}) {
  const scope = await requireScope();
  const params = await searchParams;
  const requestedIds = parsePropertyFilter(params);

  try {
  const user = await prisma.user.findUnique({
    where: { id: scope.userId },
    select: { lastBriefingViewedAt: true, firstName: true },
  });

  const properties = await prisma.property.findMany({
    // Replaced the ad-hoc name-pattern NOT clause with the canonical
    // marketable filter, which already excludes the same placeholder
    // names (via the auto-classifier on import) AND drops every other
    // IMPORTED / EXCLUDED row the operator hasn't approved.
    where: marketablePropertyWhere(scope.orgId),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Two-step gate.
  //   (1) Drop tenant-invalid ids — stored localStorage value pointing
  //       at a deleted property can never blank the briefing.
  //   (2) Intersect with the user's allowed property set so a restricted
  //       user can't URL-hack to a sibling property.
  //
  // Critical: if a restricted user's URL request resolves to an empty
  // set after gating, we DON'T pass `null` (which would widen the helpers
  // to "no filter" = see everything). We fall back to their full allowed
  // set so they see their own properties, not the whole org.
  const tenantValid = (requestedIds ?? []).filter((id) =>
    properties.some((p) => p.id === id)
  );
  const gatedIds = effectivePropertyIds(
    scope,
    tenantValid.length > 0 ? tenantValid : null,
  );
  const activePropertyIds =
    gatedIds && gatedIds.length > 0
      ? gatedIds
      : scope.allowedPropertyIds && scope.allowedPropertyIds.length > 0
        ? scope.allowedPropertyIds
        : null;
  const activeProperty =
    activePropertyIds && activePropertyIds.length === 1
      ? properties.find((p) => p.id === activePropertyIds[0]) ?? null
      : null;

  const [
    org,
    delta,
    callLeads,
    transcripts,
    metrics,
    insights,
    aging,
    appfolioIntegration,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      // primaryContactEmail is consumed by the setup-completion check
      // below so a missing notification address shows up in the wizard
      // alongside "add your first property."
      select: { name: true, primaryContactEmail: true },
    }),
    getSinceLastViewed(scope.orgId, user?.lastBriefingViewedAt ?? null),
    getCallPriorityLeads(scope.orgId, { limit: 10, propertyIds: activePropertyIds }),
    getTranscriptsWorthReading(scope.orgId, { limit: 6, propertyIds: activePropertyIds }),
    getBriefingMetrics(scope.orgId),
    getRecentInsightsForBriefing(scope.orgId, user?.lastBriefingViewedAt ?? null, 8),
    getAgingLeadsSummary(scope.orgId),
    prisma.appFolioIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: { id: true, lastSyncAt: true, syncStatus: true },
    }),
  ]);

  // Setup gate now also surfaces "set a notification email." Without
  // primaryContactEmail set on the org, lead-capture emails go nowhere
  // and the operator silently misses every inbound lead. Adding it as
  // a required step is the simplest way to keep new users from finding
  // out the hard way that their leads were quietly dropped.
  const setupSteps = [
    {
      label: "Add your first property",
      done: properties.length > 0,
      href: "/portal/properties",
    },
    {
      label: "Connect data sources",
      done: !!appfolioIntegration?.lastSyncAt,
      href: "/portal/settings/integrations",
    },
    {
      label: "Set a notification email for new leads",
      done: !!org?.primaryContactEmail,
      href: "/portal/settings",
    },
    {
      label: "Configure the AI chatbot",
      done: false,
      href: "/portal/chatbot",
    },
  ];
  const allSetupDone = setupSteps.every((s) => s.done);
  const setupComplete =
    properties.length > 0 &&
    !!appfolioIntegration?.lastSyncAt &&
    !!org?.primaryContactEmail;

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
    <div className="space-y-4 ls-page-fade min-w-0">
      {/* Canonical PageHeader — same chrome as every other page. The
          property scope picker sits in the right-aligned actions slot so
          the briefing reads as a real product surface, not a denser
          one-off layout. Per the audit, base font on this page is bumped
          from 12px to 14px so it matches the rest of the platform. */}
      <PageHeader
        eyebrow={
          activeProperty
            ? `${org?.name ?? "Workspace"} · ${activeProperty.name}`
            : (org?.name ?? "Workspace")
        }
        title={greeting}
        description="Everything that moved since you last looked. Triage the call sheet, read the transcripts, and act on the insights before your next client touch."
        actions={
          <PropertyMultiSelect
            properties={visibleProperties(scope, properties)}
            orgId={scope.orgId}
          />
        }
      />

      <SinceBanner lastViewedAt={user?.lastBriefingViewedAt ?? null} delta={delta} />

      {!setupComplete && (
        <SetupCard steps={setupSteps} />
      )}

      {aging.stale > 0 && (
        <AgingAlertBanner fresh={aging.fresh} aging={aging.aging} stale={aging.stale} />
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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

        <div className="space-y-3">
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

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
  } catch (err) {
    console.error("[BriefingPage] Failed to load briefing data:", err);
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Daily briefing"
          title="Briefing temporarily unavailable"
          description="Briefing data could not be loaded. This is usually temporary — try refreshing."
        />
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          If the issue persists, check{" "}
          <a href="/portal/connect" className="underline font-medium">
            Settings → Integrations
          </a>
          .
        </div>
      </div>
    );
  }
}

// Local PropertyFilter component removed in favor of the shared
// PropertyMultiSelect. The pill-row UX was nice but inconsistent with
// every other page; unifying lets operators learn one mental model.

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

function SetupCard({
  steps,
}: {
  steps: { label: string; done: boolean; href: string }[];
}) {
  const remaining = steps.filter((s) => !s.done);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Getting started
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            {remaining.length === steps.length
              ? "Complete these steps to activate your workspace"
              : `${remaining.length} step${remaining.length === 1 ? "" : "s"} left to finish setup`}
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {steps.filter((s) => s.done).length}/{steps.length} complete
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                step.done
                  ? "text-muted-foreground"
                  : "hover:bg-muted/50 text-foreground font-medium"
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  step.done ? "text-primary" : "text-muted-foreground/40"
                }`}
              />
              <span className={step.done ? "line-through" : ""}>{step.label}</span>
              {!step.done && (
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgingAlertBanner({
  fresh,
  aging,
  stale,
}: {
  fresh: number;
  aging: number;
  stale: number;
}) {
  return (
    <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {stale} lead{stale === 1 ? "" : "s"} {stale === 1 ? "is" : "are"} 15+ days old — conversion drops sharply after 14 days. Contact today.
        </p>
        {aging > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {aging} more {aging === 1 ? "lead" : "leads"} aging (7-14 days).
          </p>
        )}
      </div>
      <Link
        href="/portal/leads"
        className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
      >
        View all leads
      </Link>
    </div>
  );
}
