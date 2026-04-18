import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

// GET /api/auth/role
//
// Called by /auth/redirect after Clerk sign-in. Resolves the signed-in Clerk
// user to a RealEstaite User row and returns the role + org type so the
// client can route them to /admin vs /portal.
//
// Linking strategy: on first sign-in, the Clerk userId won't match any row
// (the seed writes a placeholder `seed_pending_<email>`). We fall back to
// matching by email and update clerkUserId in place so subsequent lookups
// are fast.

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const linked = await prisma.user
    .findUnique({
      where: { clerkUserId: userId },
      select: {
        role: true,
        orgId: true,
        org: { select: { orgType: true, slug: true } },
      },
    })
    .catch(() => null);

  if (linked) {
    return NextResponse.json(toResponse(linked));
  }

  const clerkUser = await currentUser().catch(() => null);
  const email =
    clerkUser?.emailAddresses?.find(
      (e) => e.id === clerkUser?.primaryEmailAddressId
    )?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    null;

  if (!email) {
    return NextResponse.json({ role: null });
  }

  const byEmail = await prisma.user
    .findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        role: true,
        orgId: true,
        org: { select: { orgType: true, slug: true } },
      },
    })
    .catch(() => null);

  if (!byEmail) {
    return NextResponse.json({ role: null });
  }

  await prisma.user
    .update({
      where: { id: byEmail.id },
      data: { clerkUserId: userId, lastLoginAt: new Date() },
    })
    .catch(() => undefined);

  return NextResponse.json(toResponse(byEmail));
}

function toResponse(user: {
  role: UserRole;
  orgId: string;
  org: { orgType: string; slug: string } | null;
}) {
  return {
    role: user.role,
    orgType: user.org?.orgType ?? null,
    orgSlug: user.org?.slug ?? null,
  };
}
