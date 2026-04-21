import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Property detail" };
export const dynamic = "force-dynamic";

export default async function PropertyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;
  const { tab } = await searchParams;

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
            className="text-xs text-[var(--stone-gray)] hover:text-[var(--near-black)]"
          >
            All properties
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2 text-[var(--near-black)]">
            {property.name}
          </h1>
          {property.addressLine1 ? (
            <p className="text-sm text-[var(--olive-gray)] mt-1">
              {property.addressLine1}
              {property.city ? `, ${property.city}` : ""}
              {property.state ? `, ${property.state}` : ""}
              {property.postalCode ? ` ${property.postalCode}` : ""}
            </p>
          ) : null}
        </div>
        <Link
          href={`/portal/properties/${property.id}/appfolio`}
          className="text-xs px-3 py-2 border border-[var(--border-cream)] rounded-md bg-[var(--ivory)] text-[var(--near-black)] hover:border-[var(--stone-gray)]"
          style={{ borderRadius: 7 }}
        >
          AppFolio settings
        </Link>
      </header>

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
          occupancy: showOccupancyTab ? (
            <OccupancyTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ) : null,
        }}
      />
    </div>
  );
}
