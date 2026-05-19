import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { OnboardingStepKey, UserRole } from "@prisma/client";
import { markStepCompleted } from "@/lib/onboarding/state-machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Roles allowed to manually advance onboarding. The checklist is a
// workspace-shaping surface; viewers and leasing agents must not be able
// to mark steps complete behind an admin's back.
const ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

const bodySchema = z
  .object({
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

// ---------------------------------------------------------------------------
// POST /api/portal/onboarding/steps/[stepKey]/complete
//
// Manually flips an onboarding step to COMPLETED. Useful when the
// detector hasn't caught up yet (operator just installed the pixel but
// no webhook event has landed) or for steps that gate on operator
// affirmation rather than platform state.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ stepKey: string }> },
) {
  try {
    const scope = await requireScope();
    if (!ALLOWED_ROLES.has(scope.role)) {
      return NextResponse.json(
        { ok: false, error: "Only org owners and admins can advance onboarding." },
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

    const snapshot = await markStepCompleted(
      scope.orgId,
      raw,
      {
        ...(parsed.data?.metadata ?? {}),
        markedManuallyByUserId: scope.userId,
      },
    );

    return NextResponse.json({ ok: true, progress: snapshot });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error(
      "[api/portal/onboarding/steps/[stepKey]/complete] POST failed:",
      err,
    );
    return NextResponse.json(
      { ok: false, error: "Failed to mark step complete" },
      { status: 500 },
    );
  }
}

function isOnboardingStepKey(s: string): s is OnboardingStepKey {
  return Object.values(OnboardingStepKey).includes(s as OnboardingStepKey);
}
