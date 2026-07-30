import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ReportDashboard } from "@/components/portal/reports/dashboard/report-dashboard";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import { PropertyHeroBanner } from "@/components/portal/properties/property-hero-banner";
import {
  ReportPrintHeader,
  ReportHeaderStrip,
} from "@/components/portal/reports/sections/report-header";
import {
  type PropertyMeta,
  periodLabel,
} from "@/components/portal/reports/snapshot-shared";
import { ReportPrintStyles } from "@/components/portal/reports/report-print-styles";
import { PrintExpander } from "@/components/portal/reports/print-expander";
import { PrintButton } from "@/components/portal/reports/print-button";
import { isValidShareToken } from "@/lib/reports/token";
import { loadPropertyHero } from "@/lib/reports/load-property-hero";
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
//
// Layout (2026-07-29): the shared link renders the SAME ReportDashboard +
// PropertyOnePager pair as the operator's report page and the reports list
// preview, so a generated report always matches what was previewed. The
// operator-only chrome (edit controls, send-email, view-count banner) lives
// in the portal page wrapper, not here, so nothing privileged leaks here.
// Print/PDF fidelity comes from the shared ReportPrintStyles + PrintExpander,
// the same pair the portal page uses.
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
      orgId: true,
      propertyId: true,
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

  // Building image pinned at the top of the report. Resolves the scoped
  // property for property-scoped reports, or the org's flagship for
  // portfolio-wide ones.
  const propertyHero = await loadPropertyHero(snapshot, report.orgId);

  // 2026-07-29 redesign: render the SAME dashboard/one-pager pair the
  // operator sees (and the reports list preview), instead of the old
  // tabbed ReportView. No operator chrome here — public, read-only.
  // Portfolio reports (propertyId null) fall back to the org name.
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
    <div className="report-page min-h-screen bg-[var(--parchment)] py-4 sm:py-10 px-2 sm:px-4">
      <ReportPrintStyles />

      <div className="mx-auto max-w-5xl space-y-5">
        <div data-no-print className="flex items-center justify-end">
          <PrintButton />
        </div>

        <PrintExpander />

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

        <ReportPrintHeader
          kindLabel={kindLabel}
          periodLabel={periodLabel(snapshot)}
          orgName={report.org?.name}
          orgLogoUrl={report.org?.logoUrl}
          headline={report.headline}
          notes={report.notes}
          propertyName={snapshot.scope?.propertyName ?? null}
        />

        {/* Display-only editorial block — headline/notes from the
            ClientReport row. No edit affordance on the public surface. */}
        <ReportHeaderStrip
          kindLabel={kindLabel}
          periodLabel={periodLabel(snapshot)}
          orgName={report.org?.name}
          orgLogoUrl={report.org?.logoUrl}
          headline={report.headline}
          notes={report.notes}
          propertyName={snapshot.scope?.propertyName ?? null}
        />

        <ReportDashboard snapshot={snapshot} property={propertyMeta} />

        <div className="hidden print:block">
          <PropertyOnePager snapshot={snapshot} property={propertyMeta} />
        </div>
      </div>
    </div>
  );
}
