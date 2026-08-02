import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import type { PropertyMeta } from "@/components/portal/reports/snapshot-shared";
import { ReportPrintStyles } from "@/components/portal/reports/report-print-styles";
import { PrintExpander } from "@/components/portal/reports/print-expander";
import { PrintButton } from "@/components/portal/reports/print-button";
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
//
// Layout (2026-08-01): the shared link renders the SAME flat single-scroll
// PropertyOnePager body the /portal/reports live preview generates, fed from
// the frozen report.snapshot instead of a fresh query — Adam rejected the
// old building-photo banner + branded header band + tabbed dashboard stack.
// The operator-only chrome (edit controls, send-email, view-count banner)
// lives in the portal page wrapper, not here, so nothing privileged leaks
// here. Print/PDF fidelity comes from the shared ReportPrintStyles +
// PrintExpander, the same pair the portal page uses.
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

  // 2026-08-01 redesign: render the SAME flat single-scroll PropertyOnePager
  // body the operator sees and the /portal/reports live preview generates,
  // instead of the old building-photo banner + branded header band + tabbed
  // dashboard stack. No operator chrome here — public, read-only.
  // Portfolio reports (propertyId null) fall back to the org name.
  const propertyRow = report.propertyId
    ? await prisma.property.findUnique({
        where: { id: report.propertyId },
        select: { name: true, addressLine1: true, city: true, state: true },
      })
    : null;
  const propertyMeta: PropertyMeta =
    propertyRow ?? { name: report.org?.name ?? "Portfolio report" };

  return (
    <div className="report-page min-h-screen bg-[var(--parchment)] py-4 sm:py-10 px-2 sm:px-4">
      <ReportPrintStyles />

      <div className="mx-auto max-w-5xl space-y-5">
        <div data-no-print className="flex items-center justify-end">
          <PrintButton />
        </div>

        <PrintExpander />

        {/* Display-only editorial block — headline/notes from the
            ClientReport row. No edit affordance on the public surface. */}
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
            live preview renders, fed from the frozen snapshot. */}
        <PropertyOnePager snapshot={snapshot} property={propertyMeta} />
      </div>
    </div>
  );
}
