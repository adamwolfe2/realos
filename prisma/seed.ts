import {
  PrismaClient,
  OrgType,
  PropertyType,
  ResidentialSubtype,
  TenantStatus,
  UserRole,
  SubscriptionTier,
  BackendPlatform,
} from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Seed script must not run in production. Aborting.");
}

const prisma = new PrismaClient();

async function main() {
  const agencySlug = process.env.AGENCY_ORG_SLUG ?? "realestaite-agency";
  const agencyEmail = process.env.AGENCY_ADMIN_EMAIL ?? "adam@realestaite.co";

  // 1. Singleton AGENCY org (us)
  const agency = await prisma.organization.upsert({
    where: { slug: agencySlug },
    update: { orgType: OrgType.AGENCY },
    create: {
      name: "RealEstaite Agency",
      slug: agencySlug,
      orgType: OrgType.AGENCY,
      status: TenantStatus.ACTIVE,
      primaryContactEmail: agencyEmail,
      primaryContactName: "Adam Wolfe",
      primaryContactRole: "Founder",
    },
  });

  // 2. Adam, the AGENCY_OWNER. clerkUserId hydrated on first Clerk login.
  await prisma.user.upsert({
    where: { email: agencyEmail },
    update: { orgId: agency.id, role: UserRole.AGENCY_OWNER },
    create: {
      clerkUserId: "seed_pending_" + agencyEmail,
      email: agencyEmail,
      firstName: "Adam",
      lastName: "Wolfe",
      role: UserRole.AGENCY_OWNER,
      orgId: agency.id,
    },
  });

  // 3. Telegraph Commons, first CLIENT tenant.
  const tc = await prisma.organization.upsert({
    where: { slug: "telegraph-commons" },
    update: {
      orgType: OrgType.CLIENT,
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
      status: TenantStatus.BUILD_IN_PROGRESS,
      subscriptionTier: SubscriptionTier.SCALE,
    },
    create: {
      name: "SG Real Estate",
      shortName: "SG",
      slug: "telegraph-commons",
      orgType: OrgType.CLIENT,
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
      status: TenantStatus.BUILD_IN_PROGRESS,
      primaryContactName: "Jessica Vernaglia",
      primaryContactEmail: "jessica@sgrealestateco.com",
      primaryContactPhone: "510-692-4200",
      primaryContactRole: "VP of Operations",
      subscriptionTier: SubscriptionTier.SCALE,
      moduleWebsite: true,
      moduleChatbot: true,
      modulePixel: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      moduleSEO: true,
      moduleLeadCapture: true,
      moduleCreativeStudio: true,
    },
  });

  await prisma.property.upsert({
    where: { orgId_slug: { orgId: tc.id, slug: "telegraph-commons" } },
    update: {
      backendPlatform: BackendPlatform.APPFOLIO,
      backendPropertyGroup: "Telegraph Commons",
    },
    create: {
      orgId: tc.id,
      name: "Telegraph Commons",
      slug: "telegraph-commons",
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
      addressLine1: "2490 Channing Way",
      city: "Berkeley",
      state: "CA",
      postalCode: "94704",
      latitude: 37.8678,
      longitude: -122.2585,
      backendPlatform: BackendPlatform.APPFOLIO,
      backendPropertyGroup: "Telegraph Commons",
      totalUnits: 100,
      description:
        "Private dorm-style student housing two blocks from UC Berkeley, all-inclusive with furnished rooms, study lounges, Berkeley shuttle access.",
    },
  });

  console.log(
    `\nSeeded:\n  - Agency org (${agency.slug})\n  - Adam as AGENCY_OWNER\n  - Telegraph Commons CLIENT tenant + property\n`
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
