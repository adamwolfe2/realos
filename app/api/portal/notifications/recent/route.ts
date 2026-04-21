import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/portal/notifications/recent
// Returns the 10 most recent unread notifications for the bell dropdown.
export async function GET() {
  try {
    const scope = await requireScope();
    const notifications = await prisma.notification.findMany({
      where: { orgId: scope.orgId },
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
