/**
 * Shared admin authorization helper.
 * Use at the top of every /api/admin/** route handler.
 *
 * Returns { userId, error } — if error is non-null, return it immediately.
 *
 * Example:
 *   const { userId, error } = await requireAdmin()
 *   if (error) return error
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Audit P1-1 (2026-07-31): these previously checked "ADMIN"/"OPS", which
// do not exist in the UserRole enum — every route behind this helper was
// permanently 403 for everyone. The real agency-side roles are below.
const ADMIN_ROLES = ["AGENCY_OWNER", "AGENCY_ADMIN"] as const;

export async function requireAdmin(): Promise<
  | { userId: string; error: null }
  | { userId: null; error: NextResponse }
> {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // auth() returns the CLERK user id. Our internal User.id is a cuid, so the
  // lookup must key on User.clerkUserId (@unique) — the same field getScope()
  // in lib/tenancy/scope.ts uses. Keying on `id` never matches, which made
  // every route behind this helper return 403 for real admins.
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  if (!user || !(ADMIN_ROLES as readonly string[]).includes(user.role)) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId, error: null };
}

/** Same as requireAdmin but also allows SALES_REP (for rep-facing admin routes) */
export async function requireAdminOrRep(): Promise<
  | { userId: string; error: null }
  | { userId: null; error: NextResponse }
> {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Same Clerk-id-vs-internal-id correction as requireAdmin above.
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  // AGENCY_OPERATOR is the limited agency role (the old "SALES_REP" intent).
  if (
    !user ||
    !["AGENCY_OWNER", "AGENCY_ADMIN", "AGENCY_OPERATOR"].includes(user.role)
  ) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId, error: null };
}
