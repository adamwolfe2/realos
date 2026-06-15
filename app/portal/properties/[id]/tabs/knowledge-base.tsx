import { prisma } from "@/lib/db";
import { parseFloorPlans, type KnowledgeBaseShape } from "@/lib/properties/kb-completeness";
import { KnowledgeBaseForm, type KnowledgeBaseRecord } from "./knowledge-base-form";

// Server tab for the structured per-property knowledge base (slice S1). Loads
// the KB row (scoped by orgId via the property relation for tenant isolation),
// normalizes the floorPlans Json into a typed array, and hands it to the
// client editor. The editor computes + renders the warn-only completeness
// banner from live state, so the server just supplies the saved record.
export async function KnowledgeBaseTab({
  orgId,
  propertyId,
  propertyName,
}: {
  orgId: string;
  propertyId: string;
  propertyName: string;
}) {
  const row = await prisma.propertyKnowledgeBase
    .findFirst({ where: { propertyId, orgId, property: { orgId } } })
    .catch(() => null);

  const kb: KnowledgeBaseRecord | null = row
    ? ({
        id: row.id,
        floorPlans: parseFloorPlans(row.floorPlans),
        communityAmenities: row.communityAmenities,
        unitAmenities: row.unitAmenities,
        petPolicy: row.petPolicy,
        parkingInfo: row.parkingInfo,
        laundryInfo: row.laundryInfo,
        utilitiesIncluded: row.utilitiesIncluded,
        smokingPolicy: row.smokingPolicy,
        leaseTerms: row.leaseTerms,
        depositInfo: row.depositInfo,
        currentSpecials: row.currentSpecials,
        applicationProcess: row.applicationProcess,
        applicationRequirements: row.applicationRequirements,
        neighborhoodInfo: row.neighborhoodInfo,
        transitInfo: row.transitInfo,
        tourInfo: row.tourInfo,
        additionalNotes: row.additionalNotes,
      } satisfies KnowledgeBaseShape & { id: string })
    : null;

  return (
    <KnowledgeBaseForm
      propertyId={propertyId}
      propertyName={propertyName}
      kb={kb}
    />
  );
}
