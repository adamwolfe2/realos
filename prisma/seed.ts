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
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

if (process.env.NODE_ENV === "production") {
  throw new Error("Seed script must not run in production. Aborting.");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const adapter = new PrismaNeonHttp(
  connectionString,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

async function main() {
  const agencySlug = process.env.AGENCY_ORG_SLUG ?? "leasestack-agency";
  const agencyEmail = process.env.AGENCY_ADMIN_EMAIL ?? "adam@leasestack.co";

  // 1. Singleton AGENCY org (us)
  const agency = await prisma.organization.upsert({
    where: { slug: agencySlug },
    update: { orgType: OrgType.AGENCY },
    create: {
      name: "LeaseStack Agency",
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

  // 3. Example CLIENT tenant for local development. Not for production.
  const demoSlug = process.env.DEMO_TENANT_SLUG ?? "demo-residences";
  const demoName = process.env.DEMO_TENANT_NAME ?? "Demo Residences";
  const demoPropertyName =
    process.env.DEMO_PROPERTY_NAME ?? "Demo Residences Main";

  const tc = await prisma.organization.upsert({
    where: { slug: demoSlug },
    update: {
      orgType: OrgType.CLIENT,
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
      status: TenantStatus.BUILD_IN_PROGRESS,
      subscriptionTier: SubscriptionTier.SCALE,
    },
    create: {
      name: demoName,
      shortName: demoName.split(" ")[0] ?? "Demo",
      slug: demoSlug,
      orgType: OrgType.CLIENT,
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
      status: TenantStatus.BUILD_IN_PROGRESS,
      primaryContactName: "Demo Contact",
      primaryContactEmail: "demo@example.com",
      primaryContactPhone: "555-0100",
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
    where: { orgId_slug: { orgId: tc.id, slug: demoSlug } },
    update: {
      backendPlatform: BackendPlatform.APPFOLIO,
      backendPropertyGroup: demoPropertyName,
    },
    create: {
      orgId: tc.id,
      name: demoPropertyName,
      slug: demoSlug,
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
      addressLine1: "100 Main Street",
      city: "Anytown",
      state: "CA",
      postalCode: "00000",
      latitude: 37.7749,
      longitude: -122.4194,
      backendPlatform: BackendPlatform.APPFOLIO,
      backendPropertyGroup: demoPropertyName,
      totalUnits: 100,
      description:
        "Private dorm-style student housing, all-inclusive with furnished rooms, study lounges, shuttle access.",
    },
  });

  console.log(
    `\nSeeded:\n  - Agency org (${agency.slug})\n  - Agency owner\n  - ${demoName} CLIENT tenant + property\n`
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
