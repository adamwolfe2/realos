import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import {
  previousStep,
  resolveCurrentStep,
  type OnboardingStep,
} from "@/lib/onboarding/steps";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/back
//
// Wizard step-back. Norman feedback (2026-06-02): hitting browser-back
// inside the wizard dropped users on the landing page because the
// wizard's step state is server-persisted (Organization.onboardingStep)
// not URL-routed. This endpoint walks the persisted step backward via
// the previousStep() helper so the next page-load renders the prior
// step.
//
// Auth: signed-in user with a provisioned org. Body is empty — we
// resolve everything from the session, not from client input.
//
// Idempotent: calling this when already on `welcome` returns
// { ok: true, currentStep: "welcome" } without writing.
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { org: { select: { id: true, onboardingStep: true } } },
  });
  if (!user?.org) {
    return NextResponse.json(
      { ok: false, error: "No workspace" },
      { status: 404 },
    );
  }

  const current = resolveCurrentStep(user.org.onboardingStep);
  const target: OnboardingStep = previousStep(current);

  // No-op when already at the floor (or terminal `done`, which previousStep
  // now keeps as `done`) — return success so a button-press that did nothing
  // observable doesn't surface an error toast.
  if (target === current) {
    return NextResponse.json({ ok: true, currentStep: current });
  }

  // Atomic terminal guard: a stale wizard tab or replayed POST must never
  // rewrite a completed (trialing) org's step from `done` back into the
  // wizard. updateMany with NOT done makes the write a no-op in that race
  // (mirrors the sibling workspace/properties/start-trial routes). (P1-3)
  const updated = await prisma.organization.updateMany({
    where: { id: user.org.id, NOT: { onboardingStep: "done" } },
    data: { onboardingStep: target },
  });
  if (updated.count === 0) {
    // The org was already `done` (or concurrently completed) — report the
    // terminal state, do not pretend we walked it back.
    return NextResponse.json({ ok: true, currentStep: "done" });
  }

  return NextResponse.json({ ok: true, currentStep: target });
}
