import "server-only";
import { prisma } from "@/lib/db";

// "Org · Property" for operator alerts (Slack, primary-contact email) so a
// multi-property org can tell which building a lead is for. Org name alone
// when the lead has no property. Scoped by orgId.
export async function leadPropertyLabel(
  orgId: string,
  orgName: string,
  propertyId: string | null | undefined,
): Promise<string> {
  if (!propertyId) return orgName;
  // Label only: a lookup failure must never cost the lead its alerts, so it
  // degrades to the org name (logged) instead of throwing.
  const property = await prisma.property
    .findFirst({ where: { id: propertyId, orgId }, select: { name: true } })
    .catch((err: unknown) => {
      console.error("[leadPropertyLabel] property lookup failed", { orgId, propertyId, err });
      return null;
    });
  return property?.name ? `${orgName} · ${property.name}` : orgName;
}
