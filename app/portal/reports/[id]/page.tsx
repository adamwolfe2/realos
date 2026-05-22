import type React from "react";
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

  // Norman feedback (May 22): the report should open with the building
  // image pinned at the top, exactly like the dashboard's Featured
  // Property card. Fetch the property record when the report is scoped
  // to one so ReportView can render the PropertyHeroBanner. Mirrors
  // the same loader logic in app/r/[token]/page.tsx — kept inline
  // rather than extracted because there are only two call sites and
  // each has slightly different auth/scope rules.
  let propertyHero: React.ComponentProps<typeof ReportView>["propertyHero"] =
    null;
  const scopedPropertyId = snapshot.scope?.propertyId ?? null;
  if (scopedPropertyId) {
    const property = await prisma.property
      .findFirst({
        where: { id: scopedPropertyId, ...tenantWhere(scope) },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          residentialSubtype: true,
          commercialSubtype: true,
          propertyType: true,
          heroImageUrl: true,
          heroImageOffsetX: true,
          heroImageOffsetY: true,
          heroImageScale: true,
          googleAggRating: true,
        },
      })
      .catch(() => null);
    if (property) {
      const subtypeRaw =
        property.residentialSubtype ??
        property.commercialSubtype ??
        property.propertyType;
      const subtype = subtypeRaw
        ?.toString()
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const location = [property.city, property.state]
        .filter(Boolean)
        .join(", ");
      propertyHero = {
        propertyId: property.id,
        propertyName: property.name,
        subtitle: [location, subtype].filter(Boolean).join(" · ") || null,
        heroImageUrl: property.heroImageUrl,
        imageOffsetX: property.heroImageOffsetX ?? 0,
        imageOffsetY: property.heroImageOffsetY ?? 0,
        imageScale: property.heroImageScale ?? 1,
        googleAggRating: property.googleAggRating,
      };
    }
  }

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

              /* Insight group expanders: the "View N →" / "Hide" toggles
                 are meaningless in print. Suppress them. The
                 PrintExpander client component force-opens every
                 <details> before window.print() fires so PDFs render
                 the full grouped list. */
              .ls-insight-group details summary > span:last-child,
              .ls-insight-group details summary > span.group-open\\:inline {
                display: none !important;
              }

              /* Tab nav is on-screen-only chrome. In print every tab
                 panel renders in document order so PDFs include the
                 entire report regardless of which tab the operator
                 had active when they hit print. */
              .ls-report-tab-strip { display: none !important; }
              .ls-report-tabpanel[hidden],
              .ls-report-tabpanel[data-active="false"] {
                display: block !important;
              }
              .ls-report-tabpanel { break-before: auto; }
              /* Tabs marked "Traffic & Leads", "Operations",
                 "Reputation", "Insights" start a fresh page so the
                 PDF reads section-by-section. */
              .ls-report-tabpanel[data-tab-id="traffic"],
              .ls-report-tabpanel[data-tab-id="operations"],
              .ls-report-tabpanel[data-tab-id="reputation"],
              .ls-report-tabpanel[data-tab-id="insights"] {
                break-before: page;
                page-break-before: always;
              }

              /* Mention previews are line-clamped on-screen for
                 scannability. In print + PDF, restore the full
                 sanitized excerpt so nothing is hidden. */
              .report-article .line-clamp-2,
              .report-article .line-clamp-3 {
                display: block !important;
                -webkit-line-clamp: unset !important;
                line-clamp: unset !important;
                overflow: visible !important;
              }
              /* The "View N more →" mention expanders flatten in print
                 (PrintExpander opens every <details>). Hide their
                 dashed-border affordance so the PDF stays clean. */
              .ls-mention-expander {
                border: none !important;
                background: transparent !important;
              }
              .ls-mention-expander summary { display: none !important; }
              .ls-mention-expander > div { border-top: none !important; padding: 0 !important; background: transparent !important; }
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
          className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary"
        >
          Client has opened this report {report.viewCount} time
          {report.viewCount === 1 ? "" : "s"}
          {report.lastViewedAt ? ` (last ${formatDateTime(report.lastViewedAt)})` : ""}.
        </div>
      ) : null}

      <PrintExpander />
      <ReportView
        snapshot={snapshot}
        headline={report.headline}
        notes={report.notes}
        orgName={report.org?.name ?? null}
        orgLogoUrl={report.org?.logoUrl ?? null}
        propertyHero={propertyHero}
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
