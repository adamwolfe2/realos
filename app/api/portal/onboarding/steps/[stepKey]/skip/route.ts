import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { OnboardingStepKey, UserRole } from "@prisma/client";
import { skipStep } from "@/lib/onboarding/state-machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same role gate as /complete — skipping a step still advances the phase
// (skipped steps count as done), so we don't let a viewer push the
// workspace forward on its own.
const ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

const bodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .optional();

// ---------------------------------------------------------------------------
// POST /api/portal/onboarding/steps/[stepKey]/skip
//
// Marks an onboarding step SKIPPED with an optional reason. The state
// machine treats skipped steps as complete for phase advancement, so
// this is the escape hatch for "I don't run paid ads, skip CONNECT_ADS."
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ stepKey: string }> },
) {
  try {
    const scope = await requireScope();
    if (!ALLOWED_ROLES.has(scope.role)) {
      return NextResponse.json(
        { ok: false, error: "Only org owners and admins can skip onboarding steps." },
        { status: 403 },
      );
    }

    const { stepKey: raw } = await ctx.params;
    if (!isOnboardingStepKey(raw)) {
      return NextResponse.json(
        { ok: false, error: `Unknown step key "${raw}"` },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const reason = parsed.data?.reason ?? "Skipped by operator";

    const snapshot = await skipStep(scope.orgId, raw, reason);
    return NextResponse.json({ ok: true, progress: snapshot });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error(
      "[api/portal/onboarding/steps/[stepKey]/skip] POST failed:",
      err,
    );
    return NextResponse.json(
      { ok: false, error: "Failed to skip step" },
      { status: 500 },
    );
  }
}

function isOnboardingStepKey(s: string): s is OnboardingStepKey {
  return Object.values(OnboardingStepKey).includes(s as OnboardingStepKey);
}
