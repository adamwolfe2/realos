import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ArrowLeft, Inbox } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { CurationQueueClient } from "./curation-queue-client";

export const metadata: Metadata = { title: "Property curation queue" };
export const dynamic = "force-dynamic";

// /portal/properties/curate
//
// Operator-facing review queue for AppFolio-imported rows that haven't
// been classified yet. Each row is a Property with lifecycle=IMPORTED.
// The operator decides:
//   - "This is a real building"  → ACTIVE (counts in dashboards)
//   - "This is a parking lot / storage / sub-record" → EXCLUDED
//
// EXCLUDED rows stay in the database (we never delete — AppFolio's
// dedup key still has to find them on re-sync) but never display in
// counts, sidebars, or onboarding progress.
//
// Operators can also see EXCLUDED rows on this page via the toggle, in
// case the auto-classifier was too aggressive and flagged a real
// building as a parking lot.

export default async function PropertyCuratePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const scope = await requireScope();
  const { view: rawView } = await searchParams;
  const view: "imported" | "excluded" =
    rawView === "excluded" ? "excluded" : "imported";

  const lifecycle = view === "imported" ? "IMPORTED" : "EXCLUDED";

  const [items, importedCount, excludedCount] = await Promise.all([
    prisma.property.findMany({
      where: { ...tenantWhere(scope), lifecycle },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        addressLine1: true,
        city: true,
        state: true,
        totalUnits: true,
        backendPlatform: true,
        backendPropertyId: true,
        excludeReason: true,
        lifecycleSetBy: true,
        lifecycleSetAt: true,
        createdAt: true,
      },
    }),
    prisma.property.count({
      where: { ...tenantWhere(scope), lifecycle: "IMPORTED" },
    }),
    prisma.property.count({
      where: { ...tenantWhere(scope), lifecycle: "EXCLUDED" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            href="/portal/properties"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to properties
          </Link>
        }
        title={
          <span className="inline-flex items-center gap-2">
            <Inbox className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Property curation queue
          </span>
        }
        description="AppFolio imports every record in your property directory — including parking lots, storage units, and other sub-records. Review and approve which ones are real buildings so dashboards, counts, and onboarding progress reflect reality."
      />

      {/* View tabs */}
      <div className="flex gap-2 flex-wrap border-b border-border pb-0">
        <Link
          href="?view=imported"
          className={
            view === "imported"
              ? "px-3 py-1.5 text-sm font-medium border-b-2 border-foreground text-foreground -mb-px"
              : "px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          Pending review
          <span className="ml-1.5 text-xs text-muted-foreground">
            {importedCount}
          </span>
        </Link>
        <Link
          href="?view=excluded"
          className={
            view === "excluded"
              ? "px-3 py-1.5 text-sm font-medium border-b-2 border-foreground text-foreground -mb-px"
              : "px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          Excluded
          <span className="ml-1.5 text-xs text-muted-foreground">
            {excludedCount}
          </span>
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={view === "imported" ? "Nothing pending review" : "No excluded properties"}
          body={
            view === "imported"
              ? "New AppFolio imports will land here."
              : "Auto-classifier hasn't flagged any sub-records."
          }
        />
      ) : (
        <CurationQueueClient
          items={items.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            address: [p.addressLine1, p.city, p.state]
              .filter(Boolean)
              .join(", "),
            totalUnits: p.totalUnits,
            backendPlatform: p.backendPlatform,
            backendPropertyId: p.backendPropertyId,
            excludeReason: p.excludeReason,
            lifecycleSetBy: p.lifecycleSetBy,
            createdAt: p.createdAt.toISOString(),
          }))}
          view={view}
        />
      )}
    </div>
  );
}
