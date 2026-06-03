/**
 * Check whether the SG Real Estate users have UserPropertyAccess
 * restrictions excluding Telegraph Commons — the most likely root cause
 * of "dashboard shows 0 even though DB has 10 leads".
 */
import { prisma } from "../lib/db";

const SG_ORG_ID = "cmo402dwz0002c93lf3okkgi0";
const TELEGRAPH_COMMONS_ID = "cmo402dzi0003c93lq9i6xz6h";

(async () => {
  const users = await prisma.user.findMany({
    where: { orgId: SG_ORG_ID },
    select: {
      id: true,
      email: true,
      role: true,
      clerkUserId: true,
      createdAt: true,
    },
  });
  console.log(`=== SG Real Estate users (${users.length}) ===`);
  for (const u of users) {
    console.log(
      `  - ${u.email ?? "(no email)"} · role=${u.role} · clerk=${u.clerkUserId ?? "(none)"} · ${u.id}`,
    );
  }

  console.log("\n=== UserPropertyAccess grants per SG user ===");
  for (const u of users) {
    const grants = await prisma.userPropertyAccess.findMany({
      where: { userId: u.id },
      select: { propertyId: true },
    });
    const tcAccess = grants.some((g) => g.propertyId === TELEGRAPH_COMMONS_ID);
    console.log(
      `  ${u.email}: ${grants.length} grant(s) · Telegraph Commons included? ${tcAccess ? "YES" : "NO"}`,
    );
    if (grants.length > 0) {
      console.log(
        `    grants:`,
        grants.map((g) => g.propertyId).join(", "),
      );
    }
  }

  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
