import "server-only";
import { prisma } from "@/lib/db";
import { canAccessReport, REPORT_PORTFOLIO_ACCESS_ERROR } from "@/lib/reports/access";

// ---------------------------------------------------------------------------
// The create-path property gate, shared by createReport (server action) and
// POST /api/portal/reports so the two cannot drift.
//   - propertyId given: must belong to the org AND be in the user's grant.
//     Both misses give the same message so the response does not reveal
//     which check fired.
//   - no propertyId: an org-wide snapshot, denied to restricted users.
// Returns the property id to persist (null = org-wide).
// ---------------------------------------------------------------------------

export const REPORT_PROPERTY_NOT_FOUND_ERROR = "Property not found in this workspace";

export class ReportPropertyAccessError extends Error {}

export async function resolveReportPropertyId(
  scope: { orgId: string; allowedPropertyIds: string[] | null },
  propertyId: string | null | undefined,
): Promise<string | null> {
  if (!propertyId) {
    if (!canAccessReport(scope, null)) {
      throw new ReportPropertyAccessError(REPORT_PORTFOLIO_ACCESS_ERROR);
    }
    return null;
  }
  const owned = await prisma.property.findFirst({
    where: { id: propertyId, orgId: scope.orgId },
    select: { id: true },
  });
  if (!owned || !canAccessReport(scope, owned.id)) {
    throw new ReportPropertyAccessError(REPORT_PROPERTY_NOT_FOUND_ERROR);
  }
  return owned.id;
}
