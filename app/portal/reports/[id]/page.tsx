import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { canAccessReport, isReportStatusRestricted } from "@/lib/reports/access";
import { getSiteUrl } from "@/lib/brand";
import { ReportDashboard } from "@/components/portal/reports/dashboard/report-dashboard";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import { PropertyHeroBanner } from "@/components/portal/properties/property-hero-banner";
import {
  ReportPrintHeader,
  ReportHeaderStrip,
} from "@/components/portal/reports/sections/report-header";
import {
  type PropertyMeta,
  periodLabel as formatPeriodLabel,
} from "@/components/portal/reports/snapshot-shared";
import { ReportPrintStyles } from "@/components/portal/reports/report-print-styles";
import { loadPropertyHero } from "@/lib/reports/load-property-hero";
import { ReportEditorControls } from "@/components/portal/reports/report-editor-controls";
import { SendEmailPanel } from "@/components/portal/reports/send-email-panel";
import { PrintButton } from "@/components/portal/reports/print-button";
import { PrintExpander } from "@/components/portal/reports/print-expander";
import { OperatorReviewBar } from "@/components/portal/reports/operator-review-bar";
import type { ReportSnapshot } from "@/lib/reports/generate";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const report = await prisma.clientReport.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: {
      id: true,
      kind: true,
      status: true,
      orgId: true,
      propertyId: true,
      snapshot: true,
      headline: true,
      notes: true,
      shareToken: true,
      sharedAt: true,
      viewCount: true,
      lastViewedAt: true,
      generatedAt: true,
      org: {
        select: {
          name: true,
          logoUrl: true,
          primaryContactEmail: true,
          primaryContactName: true,
        },
      },
    },
  });

  if (!report) notFound();
  // Property-restricted users must not open org-wide or out-of-scope
  // reports: the snapshot is the full portfolio and the page renders the
  // world-readable /r/<token> share link. Same 404 as a wrong org id.
  if (!canAccessReport(scope, report.propertyId)) notFound();
  // Real CLIENT_* users must not open a draft — operator review is
  // mandatory (lib/actions/reports.ts) so nothing here ever auto-sends.
  // Same 404 as the property gate above: no info leak about whether a
  // draft exists for this id.
  if (isReportStatusRestricted(scope) && report.status !== "shared") notFound();

  const snapshot = report.snapshot as unknown as ReportSnapshot;
  const status = (report.status as "draft" | "shared" | "archived") ?? "draft";
  const shareUrl =
    status === "shared" ? `${getSiteUrl()}/r/${report.shareToken}` : null;

  // Norman feedback (May 22): the report should open with the building
  // image pinned at the top, exactly like the dashboard's Featured
  // Property card. loadPropertyHero handles both scoped (use the
  // attached property) and portfolio reports (pick the flagship by
  // leads, then occupancy, then any LIVE property in the org) so even
  // an org-wide rollup opens with a real building photo.
  const propertyHero = await loadPropertyHero(snapshot, report.orgId);

  // 2026-07-29 redesign: the report used to render through the old tabbed
  // ReportView, which looked nothing like the polished dashboard/one-pager
  // preview on the reports list page. Now both surfaces render the SAME
  // ReportDashboard + PropertyOnePager pair the property snapshot page
  // uses (app/portal/properties/[id]/snapshot/page.tsx). Portfolio reports
  // (propertyId null) don't have a Property row, so PropertyMeta falls back
  // to the org name — every section already reads snapshot fields directly
  // and degrades gracefully without a real property.
  const propertyRow = report.propertyId
    ? await prisma.property.findUnique({
        where: { id: report.propertyId },
        select: { name: true, addressLine1: true, city: true, state: true },
      })
    : null;
  const propertyMeta: PropertyMeta =
    propertyRow ?? { name: report.org?.name ?? "Portfolio report" };

  const kindLabel =
    snapshot.kind === "weekly"
      ? "Weekly report"
      : snapshot.kind === "monthly"
        ? "Monthly report"
        : "Performance report";

  return (
    <div className="space-y-5 report-page">
      <ReportPrintStyles />

      {/* Breadcrumbs + print */}
      <div data-no-print className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          <Link href="/portal/reports" className="hover:text-foreground underline underline-offset-2">
            Reports
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">
            {report.kind} &middot; {formatDate(report.generatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Bug #117: removed duplicate top-right "Open public view" — kept inline link next to SHARED badge.
              The inline link inside OperatorReviewBar is more contextual and already covers this affordance. */}
          <PrintButton />
        </div>
      </div>

      <OperatorReviewBar
        status={status}
        hasHeadline={(report.headline?.length ?? 0) > 0}
        hasNotes={(report.notes?.length ?? 0) > 0}
        shareUrl={shareUrl}
        recipient={report.org?.primaryContactEmail ?? null}
      >
        <ReportEditorControls
          reportId={report.id}
          initialHeadline={report.headline ?? ""}
          initialNotes={report.notes ?? ""}
          status={status}
          shareUrl={shareUrl}
        />
        {status !== "archived" ? (
          <SendEmailPanel
            reportId={report.id}
            defaultRecipient={report.org?.primaryContactEmail ?? null}
            defaultRecipientName={report.org?.primaryContactName ?? null}
            canSend={
              (report.headline?.length ?? 0) > 0 ||
              (report.notes?.length ?? 0) > 0
            }
          />
        ) : null}
      </OperatorReviewBar>

      {status === "shared" && report.viewCount > 0 ? (
        <div
          data-no-print
          className="rounded-[2px] border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary"
        >
          Client has opened this report {report.viewCount} time
          {report.viewCount === 1 ? "" : "s"}
          {report.lastViewedAt ? ` (last ${formatDateTime(report.lastViewedAt)})` : ""}.
        </div>
      ) : null}

      <PrintExpander />

      {/* Norman feedback (May 22): the report should open with the building
          image pinned at the top, exactly like the dashboard's Featured
          Property card. editable=false — operators upload images from
          /portal/properties/[id], not the report. */}
      {propertyHero ? (
        <PropertyHeroBanner
          propertyId={propertyHero.propertyId}
          propertyName={propertyHero.propertyName}
          subtitle={propertyHero.subtitle}
          heroImageUrl={propertyHero.heroImageUrl}
          imageOffsetX={propertyHero.imageOffsetX ?? 0}
          imageOffsetY={propertyHero.imageOffsetY ?? 0}
          imageScale={propertyHero.imageScale ?? 1}
          editable={false}
          compact
          stats={[
            {
              label: "Captured · period",
              value: (
                snapshot.kpis.leads + (snapshot.kpis.identifiedVisitors ?? 0)
              ).toLocaleString("en-US"),
              hint: `${snapshot.kpis.leads} form + ${snapshot.kpis.identifiedVisitors ?? 0} visitors`,
            },
            {
              label: snapshot.aeoStats ? "AI search · cited" : "Tours · period",
              value: snapshot.aeoStats
                ? `${snapshot.aeoStats.cited}/${snapshot.aeoStats.totalChecks}`
                : snapshot.kpis.tours.toLocaleString("en-US"),
              hint: snapshot.aeoStats
                ? `${snapshot.aeoStats.enginesUsed.length} engines`
                : undefined,
            },
            {
              label: "Reputation",
              value:
                propertyHero.googleAggRating != null
                  ? `${propertyHero.googleAggRating.toFixed(1)}★`
                  : snapshot.reputationStats?.overallRating != null
                    ? `${snapshot.reputationStats.overallRating.toFixed(1)}★`
                    : "—",
              hint: snapshot.reputationStats?.totalReviews
                ? `${snapshot.reputationStats.totalReviews} reviews`
                : undefined,
            },
          ]}
        />
      ) : null}

      {/* Print-only branded header — hidden on screen, first thing on the
          PDF's page 1. */}
      <ReportPrintHeader
        kindLabel={kindLabel}
        periodLabel={formatPeriodLabel(snapshot)}
        orgName={report.org?.name}
        orgLogoUrl={report.org?.logoUrl}
        headline={report.headline}
        notes={report.notes}
        propertyName={snapshot.scope?.propertyName ?? null}
      />

      {/* On-screen editorial block: client branding + the operator's
          headline/note, editable above via ReportEditorControls. */}
      <ReportHeaderStrip
        kindLabel={kindLabel}
        periodLabel={formatPeriodLabel(snapshot)}
        orgName={report.org?.name}
        orgLogoUrl={report.org?.logoUrl}
        headline={report.headline}
        notes={report.notes}
        propertyName={snapshot.scope?.propertyName ?? null}
      />

      {/* Interactive dashboard — same component the reports list preview
          and property snapshot page render. */}
      <ReportDashboard snapshot={snapshot} property={propertyMeta} />

      {/* Printable one-pager — hidden on screen, the only thing that
          prints, same pattern as the property snapshot page. */}
      <div className="hidden print:block">
        <PropertyOnePager snapshot={snapshot} property={propertyMeta} />
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
