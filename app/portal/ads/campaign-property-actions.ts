"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWritableWorkspace } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";

// Pick which property an ad campaign belongs to. The sync links campaigns
// by name; this is the override for names it can't read ("TC - Leads") and
// for campaigns that serve the whole portfolio (propertyId = null).
// "Whole portfolio" is stored as NULL; the sync only auto-links a campaign
// the first time it sees it, so this choice sticks.
const WRITE_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
]);

export async function setCampaignProperty(
  campaignId: string,
  propertyId: string | null,
): Promise<{ success: true } | { error: string }> {
  try {
    const scope = await requireWritableWorkspace();
    // Users limited to some properties could move spend out of view of
    // everyone else, so only full-portfolio admins reassign.
    if (!WRITE_ROLES.has(scope.role) || scope.allowedPropertyIds) {
      return { error: "You don't have permission to change campaign properties." };
    }

    const campaign = await prisma.adCampaign.findFirst({
      where: { id: campaignId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!campaign) return { error: "Campaign not found." };

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { ...marketablePropertyWhere(scope.orgId), id: propertyId },
        select: { id: true },
      });
      if (!property) return { error: "Property not found." };
    }

    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { propertyId },
    });
    revalidatePath("/portal/ads");
    revalidatePath("/portal/properties/[id]", "page");
    return { success: true };
  } catch (err) {
    console.error("[ads] setCampaignProperty failed", { campaignId, propertyId, err });
    return { error: "Couldn't save the property. Try again." };
  }
}
