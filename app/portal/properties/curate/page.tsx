import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ArrowLeft, Inbox } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { BillingImpactCallout } from "@/components/portal/properties/billing-impact-callout";
import { CurationQueueClient } from "./curation-queue-client";
import type { SubscriptionTier } from "@prisma/client";

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

  const [items, importedCount, excludedCount, activeCount, org] =
    await Promise.all([
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
          heroImageUrl: true,
          logoUrl: true,
          websiteUrl: true,
        },
      }),
      prisma.property.count({
        where: { ...tenantWhere(scope), lifecycle: "IMPORTED" },
      }),
      prisma.property.count({
        where: { ...tenantWhere(scope), lifecycle: "EXCLUDED" },
      }),
      prisma.property.count({
        where: { ...tenantWhere(scope), lifecycle: "ACTIVE" },
      }),
      // Tier + trial state for the billing-impact callout. Pulled here
      // (not in the client) so the callout can server-render real numbers.
      prisma.organization.findUnique({
        where: { id: scope.orgId },
        select: {
          chosenTier: true,
          subscriptionTier: true,
          subscriptionStatus: true,
        },
      }),
    ]);

  const tier: SubscriptionTier | null =
    org?.chosenTier ?? org?.subscriptionTier ?? null;
  const tierId =
    tier === "STARTER"
      ? ("starter" as const)
      : tier === "GROWTH"
        ? ("growth" as const)
        : tier === "SCALE"
          ? ("scale" as const)
          : null;
  const trialing =
    org?.subscriptionStatus === "TRIALING" || org?.subscriptionStatus == null;

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
            Your full AppFolio portfolio
          </span>
        }
        description="These are all the properties LeaseStack found in your AppFolio account. Add the buildings you want LeaseStack to actively manage — those count toward dashboards, leads, and billing. Exclude anything that's a parking lot, storage unit, or sub-record."
      />

      {/* Billing impact — must read this BEFORE bulk-clicking Activate. */}
      <BillingImpactCallout
        currentActive={activeCount}
        pendingCount={importedCount}
        tierId={tierId}
        trialing={trialing}
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
          Available to add
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
          title={view === "imported" ? "All properties accounted for" : "No excluded properties"}
          body={
            view === "imported"
              ? "Every property in your AppFolio portfolio has been added or excluded. New syncs will appear here automatically."
              : "Nothing excluded yet. Auto-classifier flags parking lots and sub-records automatically."
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
            heroImageUrl: p.heroImageUrl,
            logoUrl: p.logoUrl,
            websiteUrl: p.websiteUrl,
          }))}
          view={view}
        />
      )}
    </div>
  );
}
