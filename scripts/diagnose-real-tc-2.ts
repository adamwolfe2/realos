/**
 * Follow-up: pinpoint the lead-bearing property's lifecycle state and
 * find the actual Telegraph Commons building in the SG Real Estate org.
 */
import { prisma } from "../lib/db";

const SG_ORG_ID = "cmo402dwz0002c93lf3okkgi0";
const LEAD_PROPERTY_ID = "cmo402dzi0003c93lq9i6xz6h";

(async () => {
  // 1. The property carrying 12 leads — what's its lifecycle/launch?
  const leadProp = await prisma.property.findUnique({
    where: { id: LEAD_PROPERTY_ID },
    select: {
      id: true,
      name: true,
      lifecycle: true,
      launchStatus: true,
      websiteUrl: true,
      addressLine1: true,
      city: true,
      state: true,
      propertyType: true,
    },
  });
  console.log("=== LEAD-BEARING PROPERTY ===");
  console.log(leadProp);

  // 2. The 1 ACTIVE property — what is it?
  const activeProps = await prisma.property.findMany({
    where: { orgId: SG_ORG_ID, lifecycle: "ACTIVE" },
    select: {
      id: true,
      name: true,
      launchStatus: true,
      websiteUrl: true,
      addressLine1: true,
      city: true,
    },
  });
  console.log("\n=== ACTIVE PROPERTIES ===");
  console.log(activeProps);

  // 3. Search for any property in SG Real Estate that looks like
  //    Telegraph Commons (the actual Norman building).
  const tcCandidates = await prisma.property.findMany({
    where: {
      orgId: SG_ORG_ID,
      OR: [
        { name: { contains: "telegraph", mode: "insensitive" } },
        { addressLine1: { contains: "telegraph", mode: "insensitive" } },
        { websiteUrl: { contains: "telegraph", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      lifecycle: true,
      launchStatus: true,
      addressLine1: true,
      websiteUrl: true,
    },
  });
  console.log("\n=== Properties matching 'telegraph' ===");
  console.log(tcCandidates);

  // 4. The IMPORTED properties — these are awaiting operator review.
  const imported = await prisma.property.findMany({
    where: { orgId: SG_ORG_ID, lifecycle: "IMPORTED" },
    select: {
      id: true,
      name: true,
      launchStatus: true,
      addressLine1: true,
      city: true,
    },
  });
  console.log("\n=== IMPORTED (awaiting review) ===");
  console.log(imported);

  // 5. Cross-check: where the 28d data thinks it lives.
  const leadsByPropDetail = await prisma.lead.groupBy({
    where: {
      orgId: SG_ORG_ID,
      createdAt: { gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
    },
    by: ["propertyId"],
    _count: { id: true },
  });
  console.log("\n=== 28d leads grouped by propertyId ===");
  for (const row of leadsByPropDetail) {
    if (!row.propertyId) {
      console.log(`  (NULL): ${row._count.id}`);
      continue;
    }
    const p = await prisma.property.findUnique({
      where: { id: row.propertyId },
      select: { name: true, lifecycle: true, launchStatus: true },
    });
    console.log(
      `  ${row.propertyId} (${p?.name}) [${p?.lifecycle}/${p?.launchStatus}]: ${row._count.id}`,
    );
  }

  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
