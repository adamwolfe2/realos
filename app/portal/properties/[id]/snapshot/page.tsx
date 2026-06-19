import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { generateReportSnapshot } from "@/lib/reports/generate";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import { ReportDashboard } from "@/components/portal/reports/dashboard/report-dashboard";
import { PrintButton } from "@/components/portal/reports/print-button";

export const metadata: Metadata = { title: "Marketing snapshot" };
export const dynamic = "force-dynamic";

// Per-property "Marketing & Performance Snapshot" one-pager. Generates the
// trailing-28-day snapshot live (always fresh) and renders the printable
// one-pager. Scoped strictly to the caller's org + property access so a
// restricted user can never view a sibling property by URL.
export default async function PropertySnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  // Property-restricted users must never load a sibling property's snapshot.
  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(id)) {
    notFound();
  }

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: { id: true, name: true, addressLine1: true, city: true, state: true },
  });
  if (!property) notFound();

  let snapshot;
  try {
    snapshot = await generateReportSnapshot(scope.orgId, "monthly", {
      propertyId: property.id,
    });
  } catch (err) {
    console.error("Snapshot generation failed for property", property.id, err);
    return (
      <div className="space-y-6">
        <BackBar propertyId={property.id} showPrint={false} />
        <div className="mx-auto max-w-[880px] rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          We could not generate this snapshot right now. Please try again shortly.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackBar propertyId={property.id} showPrint />
      {/* Interactive tabbed dashboard on screen. */}
      <ReportDashboard snapshot={snapshot} property={property} />
      {/* Printable one-pager — hidden on screen, the only thing that prints. */}
      <div className="hidden print:block">
        <PropertyOnePager snapshot={snapshot} property={property} />
      </div>
    </div>
  );
}

function BackBar({
  propertyId,
  showPrint,
}: {
  propertyId: string;
  showPrint: boolean;
}) {
  return (
    <div className="flex items-center justify-between print:hidden">
      <Link
        href={`/portal/properties/${propertyId}`}
        className="inline-flex items-center text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to property
      </Link>
      {showPrint ? <PrintButton /> : null}
    </div>
  );
}
