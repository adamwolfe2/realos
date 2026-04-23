import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { getSiteUrl } from "@/lib/brand";
import { ReportView } from "@/components/portal/reports/report-view";
import { ReportEditorControls } from "@/components/portal/reports/report-editor-controls";
import { SendEmailPanel } from "@/components/portal/reports/send-email-panel";
import { PrintButton } from "@/components/portal/reports/print-button";
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

  const snapshot = report.snapshot as unknown as ReportSnapshot;
  const status = (report.status as "draft" | "shared" | "archived") ?? "draft";
  const shareUrl =
    status === "shared" ? `${getSiteUrl()}/r/${report.shareToken}` : null;

  return (
    <div className="space-y-5 report-page">
      {/* Print-friendly CSS. Kept inline so every report page embeds the same
          rules without a global stylesheet change. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              [data-no-print] { display: none !important; }
              body { background: #ffffff !important; }
              .report-page { padding: 0 !important; }
              .report-article section, .report-article header {
                box-shadow: none !important;
                break-inside: avoid;
              }
              a { color: inherit; text-decoration: none; }
            }
          `,
        }}
      />

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
          {shareUrl ? (
            <Link
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Open public view
            </Link>
          ) : null}
          <PrintButton />
        </div>
      </div>

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
          canSend={(report.headline?.length ?? 0) > 0 || (report.notes?.length ?? 0) > 0}
        />
      ) : null}

      {status === "shared" && report.viewCount > 0 ? (
        <div
          data-no-print
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800"
        >
          Client has opened this report {report.viewCount} time
          {report.viewCount === 1 ? "" : "s"}
          {report.lastViewedAt ? ` (last ${formatDateTime(report.lastViewedAt)})` : ""}.
        </div>
      ) : null}

      <ReportView
        snapshot={snapshot}
        headline={report.headline}
        notes={report.notes}
        orgName={report.org?.name ?? null}
        orgLogoUrl={report.org?.logoUrl ?? null}
      />
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
