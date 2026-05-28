import { NextResponse } from "next/server";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/tenancy/scope";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scope = await requireScope();
    // Exclude resolved + currently-snoozed rows. A row's snooze expires
    // automatically when snoozedUntil <= now, so the OR clause lights the
    // bell back up without any background job.
    const now = new Date();
    const count = await prisma.notification.count({
      where: {
        orgId: scope.orgId,
        readAt: null,
        resolvedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
    });
    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
