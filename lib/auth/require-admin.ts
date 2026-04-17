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

const ADMIN_ROLES = ["ADMIN", "OPS"] as const;

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !["ADMIN", "OPS", "SALES_REP"].includes(user.role)) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId, error: null };
}
