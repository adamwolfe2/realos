import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PropertyTabs } from "./property-tabs";
import { OverviewTab } from "./tabs/overview";
import { TrafficTab } from "./tabs/traffic";
import { LeadsTab } from "./tabs/leads";
import { AdsTab } from "./tabs/ads";
import { ChatbotTab } from "./tabs/chatbot";
import { OccupancyTab } from "./tabs/occupancy";
import { ReputationTab } from "./tabs/reputation";
import { ResidentsTab } from "./tabs/residents";
import { RenewalsTab } from "./tabs/renewals";
import { WorkOrdersTab } from "./tabs/work-orders";

export const metadata: Metadata = { title: "Property detail" };
export const dynamic = "force-dynamic";

export default async function PropertyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;
  const { tab, view } = await searchParams;

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: {
      id: true,
      name: true,
      slug: true,
      propertyType: true,
      residentialSubtype: true,
      commercialSubtype: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      totalUnits: true,
      yearBuilt: true,
      backendPlatform: true,
      backendPropertyGroup: true,
      lastSyncedAt: true,
      metaTitle: true,
      metaDescription: true,
      virtualTourUrl: true,
      priceMin: true,
      priceMax: true,
      description: true,
    },
  });
  if (!property) notFound();

  const meta = { slug: property.slug, name: property.name };
  const showOccupancyTab = (property.totalUnits ?? 0) > 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/portal/properties"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            All properties
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2 text-foreground">
            {property.name}
          </h1>
          {property.addressLine1 ? (
            <p className="text-sm text-muted-foreground mt-1">
              {property.addressLine1}
              {property.city ? `, ${property.city}` : ""}
              {property.state ? `, ${property.state}` : ""}
              {property.postalCode ? ` ${property.postalCode}` : ""}
            </p>
          ) : null}
        </div>
      </header>

      <Suspense fallback={<PropertyTabsSkeleton />}>
      <PropertyTabs
        initialTab={tab ?? "overview"}
        showOccupancy={showOccupancyTab}
        panels={{
          overview: (
            <OverviewTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyMeta={meta}
              property={{
                propertyType: property.propertyType,
                residentialSubtype: property.residentialSubtype,
                commercialSubtype: property.commercialSubtype,
                totalUnits: property.totalUnits,
                yearBuilt: property.yearBuilt,
                backendPlatform: property.backendPlatform,
                backendPropertyGroup: property.backendPropertyGroup,
                lastSyncedAt: property.lastSyncedAt,
                metaTitle: property.metaTitle,
                metaDescription: property.metaDescription,
                virtualTourUrl: property.virtualTourUrl,
                priceMinCents: property.priceMin ?? null,
                priceMaxCents: property.priceMax ?? null,
                description: property.description,
              }}
            />
          ),
          traffic: (
            <TrafficTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyMeta={meta}
            />
          ),
          leads: (
            <LeadsTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyMeta={meta}
            />
          ),
          ads: (
            <AdsTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ),
          chatbot: (
            <ChatbotTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyName={property.name}
            />
          ),
          reputation: (
            <ReputationTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyName={property.name}
              propertyAddress={[
                property.addressLine1,
                property.city,
                property.state,
                property.postalCode,
              ]
                .filter(Boolean)
                .join(", ") || null}
            />
          ),
          occupancy: showOccupancyTab ? (
            <OccupancyTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ) : null,
          residents: (
            <ResidentsTab
              orgId={scope.orgId}
              propertyId={property.id}
              view={
                (["all", "active", "notice", "past", "evicted"] as const).includes(
                  view as never,
                )
                  ? (view as "all" | "active" | "notice" | "past" | "evicted")
                  : "active"
              }
            />
          ),
          renewals: (
            <RenewalsTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ),
          "work-orders": (
            <WorkOrdersTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ),
        }}
      />
      </Suspense>
    </div>
  );
}

// Streamed-tab skeleton. Renders immediately under the property header
// while the heavy per-tab Prisma queries resolve, so the page never looks
// blank between the header and the tab content. Matches the dimensions
// of the real tab bar + KPI strip closely enough that there's no layout
// shift when content arrives.
function PropertyTabsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading property data">
      <div className="flex gap-1.5 border-b border-border pb-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-muted/60 rounded-t" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 space-y-2"
          >
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <div className="h-4 w-32 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="flex justify-between gap-2"
              >
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-3 w-32 bg-muted/80 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
