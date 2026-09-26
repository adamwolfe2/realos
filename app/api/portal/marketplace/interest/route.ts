import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireWritableWorkspace, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { getModuleByKey } from "@/lib/marketplace/catalog";
import { canManageBilling } from "@/lib/billing/checkout-policy";
import { sendModuleRequestOpsEmail } from "@/lib/email/pixel-emails";
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

const bodySchema = z.object({
  moduleKey: z.string().max(64),
  // "activate" = a paid add-on the operator wants on their plan now (billing
  // page); "notify" = interest in a module that is not available yet.
  intent: z.enum(["notify", "activate"]).default("notify"),
});

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
    const moduleDef = getModuleByKey(parsed.moduleKey);
    if (!moduleDef) {
      return NextResponse.json(
        { ok: false, error: `Unknown module "${parsed.moduleKey}"` },
        { status: 400 },
      );
    }
    // Activation asks ops to change the paid plan: same gate as the
    // billing page that renders the button.
    if (parsed.intent === "activate" && !canManageBilling(scope)) {
      return NextResponse.json(
        { ok: false, error: "Only the account owner can change the plan." },
        { status: 403 },
      );
    }
    const entityType =
      parsed.intent === "activate"
        ? "Organization.moduleActivationRequest"
        : "Organization.moduleInterest";
    // Dedupe per org+module — repeat clicks (or a spamming client) must
    // not flood the org's audit trail (review 2026-07-31).
    const existing = await prisma.auditEvent.findFirst({
      where: {
        orgId: scope.orgId,
        entityType,
        diff: { path: ["module"], equals: parsed.moduleKey },
        // Activation requests can legitimately repeat (e.g. after a
        // cancel), so only dedupe them within a week.
        ...(parsed.intent === "activate"
          ? { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }
          : {}),
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    await prisma.auditEvent.create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType,
        entityId: scope.orgId,
        description:
          parsed.intent === "activate"
            ? `Requested activation of ${moduleDef.name}`
            : `Requested notification for ${moduleDef.name} availability`,
        diff: { module: parsed.moduleKey } as Prisma.InputJsonValue,
      },
    });
    // Without this the request only lands in the audit trail, which nobody
    // watches. Never blocks the response.
    const [org, requester] = await Promise.all([
      prisma.organization
        .findUnique({ where: { id: scope.orgId }, select: { name: true } })
        .catch(() => null),
      prisma.user
        .findUnique({ where: { id: scope.userId }, select: { email: true } })
        .catch(() => null),
    ]);
    const sent = await sendModuleRequestOpsEmail({
      orgId: scope.orgId,
      orgName: org?.name ?? scope.orgId,
      moduleName: moduleDef.name,
      intent: parsed.intent,
      requestedByEmail: requester?.email ?? null,
    });
    if (!sent.ok) {
      console.error("[api/portal/marketplace/interest] ops email failed:", sent.error);
    }
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
