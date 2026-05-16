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
            /* ============================================================
               PRINT + PDF RULES
               ------------------------------------------------------------
               Every .ls-report-section is a logical content block that
               must not be sliced across pages. The previous version of
               this stylesheet broke in two ways: (1) it left the portal
               sidebar / banners / top utility bar rendering in print
               which ate the entire first page before the report could
               start flowing, and (2) the parent <main> kept its
               overflow-y:auto which clipped report content to a single
               viewport-height paged region. Both are fixed below.
               ============================================================ */
            @media print {
              /* PAGE GEOMETRY — US Letter, half-inch margins all sides.
                 Half-inch is enough room for a generous typography pass
                 without wasting print real estate. */
              @page { size: letter; margin: 0.5in; }

              /* Force a clean white print canvas. Override any cool
                 slate background from the app shell. */
              html, body {
                background: #ffffff !important;
                color: #0F172A !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Hide everything explicitly tagged data-no-print, OR
                 known portal chrome that wasn't tagged yet. Broad
                 selectors here serve as belt-and-suspenders so a
                 newly-added banner that forgot the attribute still
                 disappears in print. */
              [data-no-print],
              .portal-shell > [data-no-print],
              [data-portal-nav],
              [data-impersonation],
              [data-trial-banner],
              header[data-portal-header] {
                display: none !important;
              }

              /* RESET PARENT CONSTRAINTS so the report can flow across
                 as many pages as the content needs. The portal layout
                 wraps the main content in a flex column with
                 overflow-y:auto + min-h-0, which clips content to one
                 viewport-tall scroll region. In print we want natural
                 document flow. */
              .portal-shell,
              .portal-main,
              .report-page,
              .report-page > *,
              article.report-article {
                display: block !important;
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
                min-height: 0 !important;
              }
              .portal-main { padding: 0 !important; }
              .report-page {
                padding: 0 !important;
                margin: 0 !important;
              }

              /* PRINT-ONLY BRANDED HEADER — shown at the top of page 1.
                 Hidden in the on-screen view (set in the report-view
                 component's tailwind class). */
              .print-only-header { display: block !important; }

              /* SECTION TYPOGRAPHY for print. Slightly tighter than
                 screen so we get more density per page without sacrificing
                 legibility. */
              article.report-article { font-size: 11.5pt; line-height: 1.45; }
              article.report-article h1 { font-size: 22pt; margin: 0 0 4pt; }
              article.report-article h2 { font-size: 15pt; margin: 14pt 0 6pt; }
              article.report-article h3 { font-size: 12pt; margin: 8pt 0 4pt; }

              /* SECTIONS — every report block keeps integrity, but the
                 article itself flows naturally. Strip borders + shadows
                 since they print as fuzzy outlines on most printers. */
              .ls-report { gap: 10px !important; }
              .ls-report-section,
              article.report-article header,
              article.report-article section {
                box-shadow: none !important;
                border: 1px solid #E5E7EB !important;
                border-radius: 6pt !important;
                padding: 10pt 12pt !important;
                break-inside: avoid;
                page-break-inside: avoid;
              }
              /* Specifically push a NEW page before the largest sections
                 so they always start at the top of a fresh page. Reduces
                 the number of mid-page orphans on long reports. */
              .ls-report-section[data-print-break-before="always"] {
                break-before: page;
                page-break-before: always;
              }

              /* Recharts + hand-rolled SVG charts keep their bounding
                 boxes intact when paginated. */
              svg { page-break-inside: avoid; }

              /* Suppress on-load animations when printing. Chromium's
                 PDF pipeline otherwise renders the keyframe START state
                 (empty bars, undrawn polylines, opacity:0 fades). Snap
                 everything to its final state. */
              .report-article *,
              .report-article *::before,
              .report-article *::after {
                animation: none !important;
                transition: none !important;
                opacity: 1 !important;
                transform: none !important;
                stroke-dashoffset: 0 !important;
              }
              a { color: inherit; text-decoration: none; }

              /* Background-clip:text gradient fallback for renderers
                 that don't honor the clip-path. */
              @supports not (-webkit-background-clip: text) {
                .ls-report [style*="WebkitBackgroundClip"],
                .ls-report [style*="-webkit-background-clip"] {
                  -webkit-text-fill-color: #1D4ED8 !important;
                  color: #1D4ED8 !important;
                }
              }

              /* Force tables to repeat their headers on each page so a
                 multi-page "Top landing pages" or "Top search queries"
                 table is still readable. */
              thead { display: table-header-group; }
              tr, td, th { page-break-inside: avoid; }
            }

            /* The print-only header is HIDDEN on screen and only revealed
               by the @media print rule above. */
            .print-only-header { display: none; }
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

      <div data-no-print>
        <ReportEditorControls
          reportId={report.id}
          initialHeadline={report.headline ?? ""}
          initialNotes={report.notes ?? ""}
          status={status}
          shareUrl={shareUrl}
        />
      </div>

      {status !== "archived" ? (
        <div data-no-print>
          <SendEmailPanel
            reportId={report.id}
            defaultRecipient={report.org?.primaryContactEmail ?? null}
            defaultRecipientName={report.org?.primaryContactName ?? null}
            canSend={(report.headline?.length ?? 0) > 0 || (report.notes?.length ?? 0) > 0}
          />
        </div>
      ) : null}

      {status === "shared" && report.viewCount > 0 ? (
        <div
          data-no-print
          className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary"
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
