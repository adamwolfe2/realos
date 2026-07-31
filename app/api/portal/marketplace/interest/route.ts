import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireWritableWorkspace, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { isValidModuleKey, getModuleByKey } from "@/lib/marketplace/catalog";
import { AuditAction, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/marketplace/interest
//
// Records "Notify me" interest in a not-yet-available module. Audit P0
// follow-up (2026-07-31): the button previously only flipped client-side
// state — no row anywhere, so demand signal was silently discarded.
// Persists as an AuditEvent (same table the toggle route writes) so
// interest shows up in the org's audit trail without a schema change.
// ponytail: dedicated ModuleInterest model + ops digest when demand data
// starts driving roadmap decisions.
// ---------------------------------------------------------------------------

const bodySchema = z.object({ moduleKey: z.string().max(64) });

export async function POST(req: NextRequest) {
  try {
    const scope = await requireWritableWorkspace();
    let parsed;
    try {
      parsed = bodySchema.parse(await req.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { ok: false, error: "Invalid request body" },
          { status: 400 },
        );
      }
      throw err;
    }
    if (!isValidModuleKey(parsed.moduleKey)) {
      return NextResponse.json(
        { ok: false, error: `Unknown module "${parsed.moduleKey}"` },
        { status: 400 },
      );
    }
    const moduleDef = getModuleByKey(parsed.moduleKey);
    await prisma.auditEvent.create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "Organization.moduleInterest",
        entityId: scope.orgId,
        description: `Requested notification for ${moduleDef?.name ?? parsed.moduleKey} availability`,
        diff: { module: parsed.moduleKey } as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    console.error("[api/portal/marketplace/interest] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to record interest" },
      { status: 500 },
    );
  }
}
