import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ReportView } from "@/components/portal/reports/report-view";
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
// Layout (2026-07-06): the shared link renders the SAME rich, tabbed ReportView
// the operator sees in the portal — Overview / Reputation / Insights / Content /
// Traffic & Leads / Operations — in its `publicFraming` mode. This supersedes
// the earlier one-pager treatment (which read as thin + off-brand). The
// operator-only chrome (edit controls, send-email, view-count banner) lives in
// the portal page wrapper, NOT in ReportView, so nothing privileged leaks here.
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

  // Building image pinned at the top of the report — ReportView renders the
  // hero itself when propertyHero is supplied. Resolves the scoped property
  // for property-scoped reports, or the org's flagship for portfolio-wide ones.
  const propertyHero = await loadPropertyHero(snapshot, report.orgId);

  return (
    <div className="report-page min-h-screen bg-[var(--parchment)] py-4 sm:py-10 px-2 sm:px-4">
      <ReportPrintStyles />

      <div className="mx-auto max-w-5xl space-y-5">
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
          propertyHero={propertyHero}
          publicFraming
        />
      </div>
    </div>
  );
}
