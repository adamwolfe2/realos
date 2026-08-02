import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { canAccessReport, isReportStatusRestricted } from "@/lib/reports/access";
import { getSiteUrl } from "@/lib/brand";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import type { PropertyMeta } from "@/components/portal/reports/snapshot-shared";
import { ReportPrintStyles } from "@/components/portal/reports/report-print-styles";
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
  // Operator-only surface below (headline/note editing, share/archive
  // controls, the mark-shared button, and the view-count telemetry banner)
  // — a real CLIENT_* scope reads the frozen snapshot only.
  const isOperator = !isReportStatusRestricted(scope);

  const snapshot = report.snapshot as unknown as ReportSnapshot;
  const status = (report.status as "draft" | "shared" | "archived") ?? "draft";
  const shareUrl =
    status === "shared" ? `${getSiteUrl()}/r/${report.shareToken}` : null;

  // 2026-08-01 redesign: render the SAME flat single-scroll snapshot body
  // (PropertyOnePager) the /portal/reports live preview generates, instead
  // of the old building-photo banner + branded header band + tabbed
  // dashboard stack. Adam rejected the old combo outright. Portfolio
  // reports (propertyId null) don't have a Property row, so PropertyMeta
  // falls back to the org name — every section already reads snapshot
  // fields directly and degrades gracefully without a real property.
  const propertyRow = report.propertyId
    ? await prisma.property.findUnique({
        where: { id: report.propertyId },
        select: { name: true, addressLine1: true, city: true, state: true },
      })
    : null;
  const propertyMeta: PropertyMeta =
    propertyRow ?? { name: report.org?.name ?? "Portfolio report" };

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

      {isOperator ? (
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
      ) : null}

      {isOperator && status === "shared" && report.viewCount > 0 ? (
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

      {/* Operator's headline + personal note for this client, editable
          above via ReportEditorControls. Prints too (no data-no-print). */}
      {report.headline || report.notes ? (
        <div className="ls-report-section rounded-[2px] border border-border bg-card px-5 py-4">
          {report.headline ? (
            <p className="text-sm font-semibold text-foreground leading-snug">
              {report.headline}
            </p>
          ) : null}
          {report.notes ? (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {report.notes}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Flat single-scroll snapshot body — the same PropertyOnePager the
          live preview renders, fed from the frozen snapshot instead of a
          fresh query. */}
      <PropertyOnePager snapshot={snapshot} property={propertyMeta} />
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
