import { unstable_cache } from "next/cache";
import { prisma } from "./index";

export const getOrganizationById = unstable_cache(
  async (id: string) =>
    prisma.organization.findUnique({
      where: { id },
      include: {
        addresses: true,
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ["org-by-id"],
  { revalidate: 3600, tags: ["organizations"] }
);

export const getOrganizationByUserId = unstable_cache(
  async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        org: {
          include: {
            addresses: true,
          },
        },
      },
    });
    return user?.org ?? null;
  },
  ["org-by-user-id"],
  { revalidate: 300, tags: ["organizations"] }
);

export async function getAllOrganizations() {
  return prisma.organization.findMany({
    include: {
      _count: { select: { users: true, properties: true } },
    },
    orderBy: { name: "asc" },
    take: 1000,
  });
}

// DECISION: Distribution-specific tier/spend reporting helpers removed during the
// hard fork. Real-estate admin analytics are rebuilt in Sprint 04 (master admin)
// and Sprint 10 (lead/CRM rollups) against the new models (Lead, Visitor,
// ChatbotConversation, Property, AdCampaign) instead of Order/Invoice.
