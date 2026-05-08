import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ReportView } from "@/components/portal/reports/report-view";
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
            }
          `,
        }}
      />

      <div className="max-w-5xl mx-auto space-y-5">
        <div data-no-print className="flex items-center justify-end">
          <PrintButton />
        </div>

        <ReportView
          snapshot={snapshot}
          headline={report.headline}
          notes={report.notes}
          orgName={report.org?.name ?? null}
          orgLogoUrl={report.org?.logoUrl ?? null}
          publicFraming
        />
      </div>
    </div>
  );
}
