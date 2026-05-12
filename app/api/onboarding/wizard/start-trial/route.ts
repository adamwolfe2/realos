import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTierById, getModulesForTier } from "@/lib/billing/plans";
import { computeTrialEndsAt } from "@/lib/onboarding/steps";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/start-trial
//
// Final step of the self-serve onboarding wizard. The user picks a tier
// (Foundation / Growth / Scale); we record their choice, set
// subscriptionStatus = TRIALING, stamp a 14-day trial window, and flip
// the matching module entitlements on so the tier's features are
// available immediately.
//
// No Stripe involvement here. The customer's trial is tracked entirely
// in our own DB. On day 14 (or earlier if they choose to activate
// sooner), they go through Stripe Checkout for the final conversion;
// that flow lives in a separate endpoint.
//
// Idempotent: re-calling with the same tier is a no-op against the
// existing trial; calling with a DIFFERENT tier swaps entitlements but
// keeps the original trial start date so the customer doesn't get a
// stealth trial extension by tier-switching.
// ---------------------------------------------------------------------------

const body = z.object({
  tierId: z.enum(["starter", "growth", "scale"]),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const tierDef = getTierById(parsed.tierId);
  if (!tierDef) {
    return NextResponse.json(
      { ok: false, error: `Unknown tier "${parsed.tierId}"` },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      orgId: true,
      org: {
        select: {
          trialStartedAt: true,
          trialEndsAt: true,
          subscriptionStatus: true,
        },
      },
    },
  });
  if (!user || !user.org) {
    return NextResponse.json(
      { ok: false, error: "User not provisioned" },
      { status: 404 },
    );
  }

  // Preserve the original trial start if one already exists; only stamp
  // it on the first time the user clears this step. This prevents
  // gaming the trial by repeatedly switching tiers.
  const now = new Date();
  const trialStartedAt = user.org.trialStartedAt ?? now;
  const trialEndsAt =
    user.org.trialEndsAt ?? computeTrialEndsAt(trialStartedAt);

  const modules = getModulesForTier(tierDef.tier);

  await prisma.organization.update({
    where: { id: user.orgId },
    data: {
      chosenTier: tierDef.tier as SubscriptionTier,
      subscriptionTier: tierDef.tier as SubscriptionTier,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialStartedAt,
      trialEndsAt,
      onboardingStep: "done",
      ...(modules ?? {}),
    },
  });

  return NextResponse.json({
    ok: true,
    nextStep: "done",
    trialEndsAt: trialEndsAt.toISOString(),
  });
}
