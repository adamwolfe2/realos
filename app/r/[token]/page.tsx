import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ReportView } from "@/components/portal/reports/report-view";
import { PrintButton } from "@/components/portal/reports/print-button";
import { PrintExpander } from "@/components/portal/reports/print-expander";
import { isValidShareToken } from "@/lib/reports/token";
import type { ReportSnapshot } from "@/lib/reports/generate";

export const metadata: Metadata = {
  title: "Performance report",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /r/[token] — public read-only report view.
//
// Unauthenticated. Looks up ClientReport by shareToken; 404s unless status is
// "shared". On success, increments viewCount + lastViewedAt so the operator
// can see who's engaging with which report.
// ---------------------------------------------------------------------------

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isValidShareToken(token)) notFound();

  const report = await prisma.clientReport.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      status: true,
      kind: true,
      snapshot: true,
      headline: true,
      notes: true,
      org: {
        select: { name: true, logoUrl: true },
      },
    },
  });

  if (!report || report.status !== "shared") notFound();

  // Fire-and-forget view tracking. Errors never block the render.
  await prisma.clientReport
    .update({
      where: { id: report.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    })
    .catch(() => {
      /* intentional: view tracking is best-effort */
    });

  const snapshot = report.snapshot as unknown as ReportSnapshot;

  // Norman feedback (May 22): the shared report should open with the
  // property's building image pinned at the top — same hero treatment
  // as the main dashboard's Featured Property card. Fetch the
  // property record when the snapshot is scoped to one so ReportView
  // can render the PropertyHeroBanner. Portfolio-wide reports skip
  // the lookup entirely and fall through to the text-only header.
  let propertyHero: React.ComponentProps<typeof ReportView>["propertyHero"] =
    null;
  const scopedPropertyId = snapshot.scope?.propertyId ?? null;
  if (scopedPropertyId) {
    const property = await prisma.property
      .findUnique({
        where: { id: scopedPropertyId },
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
    <div className="min-h-screen bg-[var(--parchment)] py-10 px-4">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              [data-no-print] { display: none !important; }
              body { background: #ffffff !important; }
              .report-article section, .report-article header {
                box-shadow: none !important;
                break-inside: avoid;
              }
              a { color: inherit; text-decoration: none; }
              /* Skip the on-load animations entirely when printing.
                 PDF exporters render the keyframe START state and end
                 up with empty bars / undrawn lines if we don't snap
                 them to their final values here. */
              .report-article *,
              .report-article *::before,
              .report-article *::after {
                animation: none !important;
                transition: none !important;
                opacity: 1 !important;
                transform: none !important;
                stroke-dashoffset: 0 !important;
              }
              /* Tab chrome is on-screen-only. Every tab panel renders
                 in print so PDFs include the whole report. */
              .ls-report-tab-strip { display: none !important; }
              .ls-report-tabpanel[hidden],
              .ls-report-tabpanel[data-active="false"] {
                display: block !important;
              }
              .ls-insight-group details summary > span:last-child,
              .ls-insight-group details summary > span.group-open\\:inline {
                display: none !important;
              }
            }
          `,
        }}
      />

      <div className="max-w-5xl mx-auto space-y-5">
        <div data-no-print className="flex items-center justify-end">
          <PrintButton />
        </div>

        <PrintExpander />
        <ReportView
          snapshot={snapshot}
          headline={report.headline}
          notes={report.notes}
          orgName={report.org?.name ?? null}
          orgLogoUrl={report.org?.logoUrl ?? null}
          publicFraming
          propertyHero={propertyHero}
        />
      </div>
    </div>
  );
}
