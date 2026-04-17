/**
 * One-time bootstrap, elevates the currently signed-in Clerk user to
 * AGENCY_OWNER and attaches them to the singleton AGENCY organization.
 * Protected by BOOTSTRAP_SECRET so it can't be called by anyone else.
 *
 * Usage (run once after first deploy):
 *   curl -X POST https://realos.dev/api/admin/bootstrap \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret":"<BOOTSTRAP_SECRET>"}'
 */
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { UserRole, OrgType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { secret } = await req.json().catch(() => ({ secret: "" }));
  if (!secret || secret !== process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Could not fetch user" }, { status: 500 });
  }

  // Idempotency: only bootstrap if no AGENCY_OWNER exists yet, or the caller
  // is already one.
  const existingOwners = await prisma.user.count({
    where: { role: UserRole.AGENCY_OWNER },
  });
  if (existingOwners > 0) {
    const caller = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    if (caller?.role !== UserRole.AGENCY_OWNER) {
      return NextResponse.json(
        { error: "Bootstrap already completed. Contact an existing owner." },
        { status: 409 }
      );
    }
  }

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? `${userId}@unknown.com`;

  // Ensure the singleton agency org exists.
  const agency = await prisma.organization.upsert({
    where: { slug: process.env.AGENCY_ORG_SLUG ?? "realos-agency" },
    update: { orgType: OrgType.AGENCY },
    create: {
      name: "RealOS Agency",
      slug: process.env.AGENCY_ORG_SLUG ?? "realos-agency",
      orgType: OrgType.AGENCY,
    },
  });

  const user = await prisma.user.upsert({
    where: { clerkUserId: userId },
    update: { role: UserRole.AGENCY_OWNER, orgId: agency.id, email },
    create: {
      clerkUserId: userId,
      email,
      firstName: clerkUser.firstName ?? null,
      lastName: clerkUser.lastName ?? null,
      role: UserRole.AGENCY_OWNER,
      orgId: agency.id,
    },
  });

  return NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
  });
}
