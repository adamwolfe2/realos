import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/portal/notifications?limit=50
// Returns paginated notifications for the inbox page, newest first.
export async function GET(req: NextRequest) {
  try {
    const scope = await requireScope();
    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "50", 10),
      200
    );

    const notifications = await prisma.notification.findMany({
      where: { orgId: scope.orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
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
