// ---------------------------------------------------------------------------
// ReportPrintStyles — the print/PDF stylesheet shared by BOTH the authenticated
// portal report page (app/portal/reports/[id]/page.tsx) and the public share
// view (app/r/[token]/page.tsx). Kept in one place so the two routes never
// diverge: a fix to how a PDF paginates should apply everywhere a report can
// be printed.
//
// Every logical content block carries `.ls-report-section`; the rules below
// keep those blocks intact across page breaks, strip portal chrome, and snap
// on-load animations to their final state so Chromium's PDF pipeline doesn't
// capture empty keyframe-start charts. See inline comments for the specific
// bugs each rule guards against.
// ---------------------------------------------------------------------------

export function ReportPrintStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @media print {
            /* PAGE GEOMETRY — US Letter, half-inch margins all sides. */
            @page { size: letter; margin: 0.5in; }

            /* Force a clean white print canvas. */
            html, body {
              background: #ffffff !important;
              color: #0F172A !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Hide everything tagged data-no-print OR known portal chrome. */
            [data-no-print],
            .portal-shell > [data-no-print],
            [data-portal-nav],
            [data-impersonation],
            [data-trial-banner],
            header[data-portal-header] {
              display: none !important;
            }

            /* RESET PARENT CONSTRAINTS so the report flows across as many
               pages as its content needs. */
            .portal-shell,
            .portal-main,
            .report-page,
            /* :not(style) is load-bearing — the inline print <style> is a
               direct child of .report-page. Without the exclusion the reset
               un-hides the <style> element and its raw CSS prints as text. */
            .report-page > *:not(style),
            article.report-article {
              display: block !important;
              overflow: visible !important;
              height: auto !important;
              max-height: none !important;
              min-height: 0 !important;
            }
            /* Belt-and-suspenders: never let a <style> element paint. */
            .report-page > style,
            style { display: none !important; }
            .portal-main { padding: 0 !important; }
            .report-page {
              padding: 0 !important;
              margin: 0 !important;
            }

            /* PRINT-ONLY BRANDED HEADER — shown at the top of page 1. */
            .print-only-header { display: block !important; }

            /* SECTION TYPOGRAPHY for print. */
            article.report-article { font-size: 11.5pt; line-height: 1.45; }
            article.report-article h1 { font-size: 22pt; margin: 0 0 4pt; }
            article.report-article h2 { font-size: 15pt; margin: 14pt 0 6pt; }
            article.report-article h3 { font-size: 12pt; margin: 8pt 0 4pt; }

            /* SECTIONS keep integrity; the article flows naturally. */
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
            .ls-report-section[data-print-break-before="always"] {
              break-before: page;
              page-break-before: always;
            }

            /* Charts keep their bounding boxes intact when paginated. */
            svg { page-break-inside: avoid; }

            /* Suppress on-load animations when printing. */
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

            /* Background-clip:text gradient fallback. */
            @supports not (-webkit-background-clip: text) {
              .ls-report [style*="WebkitBackgroundClip"],
              .ls-report [style*="-webkit-background-clip"] {
                -webkit-text-fill-color: #1D4ED8 !important;
                color: #1D4ED8 !important;
              }
            }

            /* Repeat table headers on each page. */
            thead { display: table-header-group; }
            tr, td, th { page-break-inside: avoid; }

            /* Insight group expanders are meaningless in print. */
            .ls-insight-group details summary > span:last-child,
            .ls-insight-group details summary > span.group-open\\:inline {
              display: none !important;
            }

            /* Tab nav is on-screen-only chrome. In print every tab panel
               renders in document order so PDFs include the entire report. */
            .ls-report-tab-strip { display: none !important; }
            .ls-report-tabpanel[hidden],
            .ls-report-tabpanel[data-active="false"] {
              display: block !important;
            }
            .ls-report-tabpanel { break-before: auto; }
            .ls-report-tabpanel[data-tab-id="reputation"],
            .ls-report-tabpanel[data-tab-id="insights"],
            .ls-report-tabpanel[data-tab-id="content"],
            .ls-report-tabpanel[data-tab-id="traffic"],
            .ls-report-tabpanel[data-tab-id="operations"] {
              break-before: page;
              page-break-before: always;
            }

            /* Restore full mention excerpts in print. */
            .report-article .line-clamp-2,
            .report-article .line-clamp-3 {
              display: block !important;
              -webkit-line-clamp: unset !important;
              line-clamp: unset !important;
              overflow: visible !important;
            }
            .ls-mention-expander {
              border: none !important;
              background: transparent !important;
            }
            .ls-mention-expander summary { display: none !important; }
            .ls-mention-expander > div { border-top: none !important; padding: 0 !important; background: transparent !important; }
          }

          /* The print-only header is HIDDEN on screen. */
          .print-only-header { display: none; }
        `,
      }}
    />
  );
}
