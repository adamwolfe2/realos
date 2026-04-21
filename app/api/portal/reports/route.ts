import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { generateReportSnapshot, type ReportKind } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/reports
// Body: { kind: "weekly" | "monthly" | "custom" }
// Creates a new ClientReport in draft status with a frozen snapshot.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const scope = await requireScope();
    const body = await req.json().catch(() => null);
    const kind = body?.kind as ReportKind | undefined;

    if (kind !== "weekly" && kind !== "monthly" && kind !== "custom") {
      return NextResponse.json(
        { error: "Invalid kind. Expected weekly, monthly, or custom." },
        { status: 400 },
      );
    }

    const snapshot = await generateReportSnapshot(scope.orgId, kind);

    const report = await prisma.clientReport.create({
      data: {
        orgId: scope.orgId,
        kind,
        periodStart: new Date(snapshot.periodStart),
        periodEnd: new Date(snapshot.periodEnd),
        snapshot: snapshot as object as never,
        shareToken: generateShareToken(),
        status: "draft",
        generatedBy: scope.userId,
      },
      select: {
        id: true,
        kind: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        generatedAt: true,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /api/portal/reports?kind=&status=&limit=
// Lists ClientReports for the tenant, newest first.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const scope = await requireScope();
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const status = url.searchParams.get("status");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "50", 10),
      200,
    );

    const where: Record<string, unknown> = { orgId: scope.orgId };
    if (kind === "weekly" || kind === "monthly" || kind === "custom") {
      where.kind = kind;
    }
    if (status === "draft" || status === "shared" || status === "archived") {
      where.status = status;
    }

    const reports = await prisma.clientReport.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        generatedAt: true,
        sharedAt: true,
        viewCount: true,
        headline: true,
      },
    });

    return NextResponse.json({ reports });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
