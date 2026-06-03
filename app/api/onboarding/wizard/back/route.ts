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

  // No-op when already at the floor — return success so the client
  // doesn't show an error toast for a button-press that did nothing
  // observable.
  if (target === current) {
    return NextResponse.json({ ok: true, currentStep: current });
  }

  await prisma.organization.update({
    where: { id: user.org.id },
    data: { onboardingStep: target },
  });

  return NextResponse.json({ ok: true, currentStep: target });
}
