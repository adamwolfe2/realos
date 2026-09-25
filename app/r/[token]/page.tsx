import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import { periodLabel } from "@/components/portal/reports/snapshot-shared";
import { ReportPrintStyles } from "@/components/portal/reports/report-print-styles";
import { PrintExpander } from "@/components/portal/reports/print-expander";
import { PrintButton } from "@/components/portal/reports/print-button";
import { isValidShareToken } from "@/lib/reports/token";
import { loadReportHero, loadReportProperty } from "@/lib/reports/load-property-hero";
import type { ReportSnapshot } from "@/lib/reports/generate";

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
//
// 2026-09-15: the building image is back inside the one-pager header — NOT
// the full-bleed banner Adam rejected above. 2026-09-19: Adam asked for a
// proper cover (property name as the title, address, website, building on a
// tinted panel); see PropertyOnePager's header. The
// link is now sent to prospects, so it also carries a real social preview
// (title/description/og:image). `robots: noindex` stays: a share token is
// not a public URL and must never land in a search index.
// ---------------------------------------------------------------------------

// Shared by generateMetadata and the page body so a request runs the report
// query once, not twice. React `cache` dedupes within a single render pass.
const loadSharedReport = cache(async (token: string) => {
  if (!isValidShareToken(token)) return null;

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

  if (!report || report.status !== "shared") return null;

  const snapshot = report.snapshot as unknown as ReportSnapshot;

  const property = await loadReportProperty({
    propertyId: report.propertyId,
    orgId: report.orgId,
    orgName: report.org?.name,
  });

  // Building image: scoped property first, then the org's real flagship,
  // so a portfolio report still gets a photo instead of a bare header.
  const hero = await loadReportHero(snapshot, report.orgId, property.name);

  return { report, snapshot, property, hero };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await loadSharedReport(token);

  // Unknown/unshared token: keep the generic title so the 404 path doesn't
  // confirm whether a token exists.
  if (!data) {
    return { title: "Performance report", robots: { index: false, follow: false } };
  }

  const title = `${data.property.name} | Marketing & Performance Report`;
  const description = `${periodLabel(data.snapshot)}. Leasing, traffic, and reputation performance, prepared by LeaseStack.`;

  return {
    title,
    description,
    // A share token is a capability URL — never index it, even though the
    // page is now presentable enough to send to prospects.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      images: data.hero ? [{ url: data.hero.imageUrl, alt: data.hero.name }] : [],
    },
    twitter: {
      card: data.hero ? "summary_large_image" : "summary",
      title,
      description,
      images: data.hero ? [data.hero.imageUrl] : [],
    },
  };
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadSharedReport(token);
  if (!data) notFound();

  const { report, snapshot, property, hero } = data;

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

  return (
    <div className="report-page min-h-screen bg-background py-4 sm:py-10 px-2 sm:px-4">
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
        <PropertyOnePager snapshot={snapshot} property={property} hero={hero} />
      </div>
    </div>
  );
}
