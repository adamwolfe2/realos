import { NextRequest, NextResponse } from "next/server";
import { requireScope, requireWritableWorkspace, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { generateReportSnapshot } from "@/lib/reports/generate";
import {
  resolveReportPropertyId,
  ReportPropertyAccessError,
} from "@/lib/reports/resolve-property";
import { propertyWhereFragment } from "@/lib/tenancy/property-filter";
import { generateShareToken } from "@/lib/reports/token";
import {
  isReportStatusRestricted,
  REPORT_OPERATOR_ONLY_ERROR,
} from "@/lib/reports/access";
import { aiCallLimiter, checkRateLimit, rateLimited } from "@/lib/rate-limit";
import {
  checkAiBillingGate,
  aiBillingDeniedResponseBody,
} from "@/lib/billing/gate";

export const dynamic = "force-dynamic";

const CreateReportBody = z.object({
  kind: z.enum(["weekly", "monthly", "custom"]),
  propertyId: z.string().min(1).max(64).nullish(),
});

// ---------------------------------------------------------------------------
// POST /api/portal/reports
// Body: { kind: "weekly" | "monthly" | "custom", propertyId?: string }
// Creates a new ClientReport in draft status with a frozen snapshot.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const scope = await requireWritableWorkspace();

    // Reports are OPERATOR-managed (lib/reports/access.ts): a real CLIENT_*
    // scope must not be able to generate a report and burn LLM budget on
    // demand — same gate as createReport() in lib/actions/reports.ts, now
    // enforced here too so this REST route can't be used to route around it.
    if (isReportStatusRestricted(scope)) {
      return NextResponse.json(
        { error: REPORT_OPERATOR_ONLY_ERROR },
        { status: 403 },
      );
    }

    // Body first so the property gate can run before any AI spend. A
    // restricted user (UserPropertyAccess scoped to 1-of-N buildings) may
    // generate a report for a granted property only; the org-wide rollup
    // (no propertyId) would include buildings they cannot see, and the
    // shareToken makes the snapshot world-readable. Same gate as
    // createReport (lib/reports/resolve-property.ts).
    const parsed = CreateReportBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid kind. Expected weekly, monthly, or custom." },
        { status: 400 },
      );
    }
    const { kind } = parsed.data;
    let propertyId: string | null;
    try {
      propertyId = await resolveReportPropertyId(scope, parsed.data.propertyId);
    } catch (err) {
      if (err instanceof ReportPropertyAccessError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      throw err;
    }

    // Billing gate — report generation invokes the LLM polish helper
    // (lib/insights/llm-polish.ts) which calls Claude Haiku. Block
    // delinquent tenants from spending Anthropic budget.
    const billingGate = await checkAiBillingGate(scope.orgId, scope);
    if (!billingGate.allowed) {
      return NextResponse.json(aiBillingDeniedResponseBody(billingGate), {
        status: 402,
      });
    }

    // Per-user hourly AI rate limit (10/hr).
    const rl = await checkRateLimit(aiCallLimiter, `ai-call:${scope.userId}`);
    if (!rl.allowed) {
      const retry = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
      return rateLimited(
        "AI rate limit hit (10 calls per hour). Try again soon.",
        retry,
      );
    }

    const snapshot = await generateReportSnapshot(scope.orgId, kind, { propertyId });

    const report = await prisma.clientReport.create({
      data: {
        orgId: scope.orgId,
        propertyId,
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
        propertyId: true,
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
// GET /api/portal/reports?kind=&status=&limit=&propertyId=
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

    // Property scope: ?propertyId= narrows to one building. A restricted
    // user only ever lists reports for granted properties: org-wide reports
    // (propertyId null) roll up buildings they can't see, so they are
    // excluded, and an out-of-grant ?propertyId= matches nothing.
    const propertyParam = url.searchParams.get("propertyId");
    const where: Record<string, unknown> = {
      orgId: scope.orgId,
      ...propertyWhereFragment(scope, propertyParam ? [propertyParam] : null),
    };
    if (kind === "weekly" || kind === "monthly" || kind === "custom") {
      where.kind = kind;
    }
    // Real CLIENT_* users only ever see shared reports — clamp regardless of
    // ?status=, so a hand-crafted URL (?status=draft) can't enumerate drafts.
    // Mirrors app/portal/reports/page.tsx's statusRestricted clamp exactly.
    if (isReportStatusRestricted(scope)) {
      where.status = "shared";
    } else if (status === "draft" || status === "shared" || status === "archived") {
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
        propertyId: true,
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
