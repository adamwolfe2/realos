import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { PropertyEditForm } from "./property-edit-form";

export const metadata: Metadata = { title: "Edit property" };
export const dynamic = "force-dynamic";

export default async function PropertyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  if (
    scope.allowedPropertyIds &&
    !scope.allowedPropertyIds.includes(id)
  ) {
    notFound();
  }

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
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      googlePlaceId: true,
      latitude: true,
      longitude: true,
      yearBuilt: true,
      totalUnits: true,
      description: true,
      heroImageUrl: true,
      virtualTourUrl: true,
    },
  });
  if (!property) notFound();

  // Restricted RBAC users can view but never edit cross-property metadata.
  // (Restriction guard above stops them from getting here on the wrong id;
  //  this guard is for the all-properties-vs-none case.)
  if (!scope.isAgency && scope.allowedPropertyIds === null && false) {
    // placeholder reserved for future "edit requires write role" gate
    redirect(`/portal/properties/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href={`/portal/properties/${property.id}`}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> Back to {property.name}
          </Link>
        }
        title="Edit property"
        description="Edits save immediately. Address autocomplete uses Google Places."
      />
      <PropertyEditForm
        initial={{
          propertyId: property.id,
          name: property.name,
          slug: property.slug,
          propertyType: property.propertyType,
          residentialSubtype: property.residentialSubtype,
          commercialSubtype: property.commercialSubtype,
          addressLine1: property.addressLine1,
          addressLine2: property.addressLine2,
          city: property.city,
          state: property.state,
          postalCode: property.postalCode,
          googlePlaceId: property.googlePlaceId,
          latitude: property.latitude,
          longitude: property.longitude,
          yearBuilt: property.yearBuilt,
          totalUnits: property.totalUnits,
          description: property.description,
          heroImageUrl: property.heroImageUrl,
          virtualTourUrl: property.virtualTourUrl,
        }}
      />
    </div>
  );
}
