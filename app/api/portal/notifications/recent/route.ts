import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/portal/notifications/recent
// Returns the 10 most recent unread notifications for the bell dropdown.
export async function GET() {
  try {
    const scope = await requireScope();
    // Bell dropdown shows the 10 most recent ACTIVE rows — exclude
    // resolved and currently-snoozed. Snoozed rows reappear automatically
    // once snoozedUntil passes.
    const now = new Date();
    const notifications = await prisma.notification.findMany({
      where: {
        orgId: scope.orgId,
        resolvedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ notifications });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
