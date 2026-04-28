// One-shot: promote a user to AGENCY_OWNER on the agency org.
// Usage: node scripts/promote-to-agency-owner.mjs adamwolfe102@gmail.com
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/promote-to-agency-owner.mjs <email>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Run: set -a && source .env.local && set +a");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

try {
  const agency = await prisma.organization.findFirst({
    where: { orgType: "AGENCY" },
    select: { id: true, name: true, slug: true },
  });
  if (!agency) {
    console.error("No AGENCY org found in DB. Seed one first.");
    process.exit(1);
  }
  console.log(`Agency org: ${agency.name} (${agency.id})`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, orgId: true, role: true, firstName: true, lastName: true },
  });
  if (!user) {
    console.error(
      `No user found with email ${email}. Sign in once with that account first so a User row gets created, then re-run this script.`,
    );
    process.exit(1);
  }
  console.log(`Before: ${user.email} role=${user.role} orgId=${user.orgId}`);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "AGENCY_OWNER", orgId: agency.id },
    select: { id: true, email: true, orgId: true, role: true },
  });
  console.log(`After:  ${updated.email} role=${updated.role} orgId=${updated.orgId}`);
  console.log("Done. Sign out and sign back in for the new role to take effect.");
} finally {
  await prisma.$disconnect();
}
