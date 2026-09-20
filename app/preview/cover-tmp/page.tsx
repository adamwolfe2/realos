// TEMP local preview harness (untracked, never committed). Read-only: it
// deliberately does NOT increment the real report's view counter.
import { prisma } from "@/lib/db";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import { ReportPrintStyles } from "@/components/portal/reports/report-print-styles";
import { loadReportHero, loadReportProperty } from "@/lib/reports/load-property-hero";
import type { ReportSnapshot } from "@/lib/reports/generate";
export const dynamic = "force-dynamic";
export default async function P() {
  const r = await prisma.clientReport.findUnique({ where: { shareToken: "PkiYZL0MewawaW3WZeX-oKYO" }, select: { orgId: true, propertyId: true, snapshot: true, org: { select: { name: true } } } });
  if (!r) return <p>missing</p>;
  const snapshot = r.snapshot as unknown as ReportSnapshot;
  const property = await loadReportProperty({ propertyId: r.propertyId, orgId: r.orgId, orgName: r.org?.name });
  const hero = await loadReportHero(snapshot, r.orgId, property.name);
  return (<div className="report-page min-h-screen bg-[var(--parchment)] py-4 sm:py-10 px-2 sm:px-4"><ReportPrintStyles /><div className="mx-auto max-w-5xl space-y-5"><PropertyOnePager snapshot={snapshot} property={property} hero={hero} /></div></div>);
}
