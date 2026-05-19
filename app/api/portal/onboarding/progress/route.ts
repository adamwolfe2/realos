import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { syncOnboardingProgress } from "@/lib/onboarding/step-detectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/onboarding/progress
//
// Returns the current onboarding snapshot for the operator's org. Each
// call also runs the cheap detector sync (auto-completes any steps that
// have flipped since last visit) so the UI never shows stale state.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const scope = await requireScope();
    const snapshot = await syncOnboardingProgress(scope.orgId);
    return NextResponse.json({ ok: true, progress: snapshot });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("[api/portal/onboarding/progress] GET failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load onboarding progress" },
      { status: 500 },
    );
  }
}
