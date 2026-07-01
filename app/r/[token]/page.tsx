import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PropertyHeroBanner } from "@/components/portal/properties/property-hero-banner";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import { PrintButton } from "@/components/portal/reports/print-button";
import { isValidShareToken } from "@/lib/reports/token";
import { loadPropertyHero } from "@/lib/reports/load-property-hero";
import type { ReportSnapshot } from "@/lib/reports/generate";
import type { PropertyMeta } from "@/components/portal/reports/snapshot-shared";

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
// Layout (2026-07-01): the shared link now renders the BEAUTIFUL one-pager
// (PropertyOnePager) instead of the busy tabbed ReportView shell. Composition,
// top to bottom:
//   1. PropertyHeroBanner — Norman's May-22 requirement: the building image
//      pinned at the top (loadPropertyHero resolves the scoped/flagship
//      property). Portfolio-wide reports without any property fall through.
//   2. Operator headline + personal note — the human layer the client reads
//      first, authored in the report editor.
//   3. PropertyOnePager — the single-page Marketing & Performance Snapshot.
//   4. Public framing footer.
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

  // Building image pinned at the top — same hero treatment as the main
  // dashboard's Featured Property card. Resolves the scoped property for
  // property-scoped reports, or the org's flagship for portfolio-wide ones.
  const propertyHero = await loadPropertyHero(snapshot, report.orgId);

  // PropertyOnePager needs a property label. Prefer the snapshot's own scope,
  // then the resolved hero, then the org name for portfolio-wide reports.
  const property: PropertyMeta = {
    name:
      snapshot.scope?.propertyName ??
      propertyHero?.propertyName ??
      report.org?.name ??
      "Portfolio",
  };

  const hasOperatorNote = Boolean(report.headline || report.notes);

  return (
    <div className="min-h-screen bg-[var(--parchment)] py-4 sm:py-10 px-2 sm:px-4">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              [data-no-print] { display: none !important; }
              body { background: #ffffff !important; }
              a { color: inherit; text-decoration: none; }
            }
          `,
        }}
      />

      <div className="max-w-5xl mx-auto space-y-5">
        <div data-no-print className="flex items-center justify-end">
          <PrintButton />
        </div>

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

        {hasOperatorNote ? (
          <section className="mx-auto w-full max-w-[880px] rounded-2xl border border-border bg-card p-6 shadow-sm">
            {report.headline ? (
              <p className="text-lg font-semibold leading-snug text-foreground">
                {report.headline}
              </p>
            ) : null}
            {report.notes ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {report.notes}
              </p>
            ) : null}
          </section>
        ) : null}

        <PropertyOnePager snapshot={snapshot} property={property} />

        <footer className="pt-2 text-center text-[11px] text-muted-foreground">
          Generated by LeaseStack on behalf of {report.org?.name ?? "your operator"}.
        </footer>
      </div>
    </div>
  );
}
