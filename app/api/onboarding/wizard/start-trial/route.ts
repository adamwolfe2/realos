import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeTrialEndsAt } from "@/lib/onboarding/steps";
import {
  buildModuleStateFromSelection,
  inferTierFromSelection,
} from "@/lib/billing/features";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/start-trial
//
// Final step of the self-serve onboarding wizard. The user picks a tier
// (Foundation / Growth / Scale) and a set of modules they want to test
// during the trial. We:
//
//   1. Record the chosen tier
//   2. Stamp subscriptionStatus = TRIALING with a 14-day trial window
//   3. Flip the tier's default module entitlements on
//   4. ADDITIONALLY flip on any extra modules the operator hand-picked
//      (every module is free during trial — they only pay if they
//      keep modules at the conversion-to-paid step)
//
// No Stripe involvement here. On day 14, the activate-subscription flow
// reads back the active module flags to build the Stripe Checkout line
// items via /api/billing/checkout (which already accepts addOnLookupKeys).
//
// Idempotent: re-calling with the same tier is a no-op against the
// existing trial; calling with a DIFFERENT tier swaps entitlements but
// keeps the original trial start date so the customer doesn't get a
// stealth trial extension by tier-switching.
// ---------------------------------------------------------------------------

// À-la-carte: the cart sends the exact set of feature module keys the operator
// selected. We write that EXACT state to the org (always-on base + selected
// features true, everything else false) — no tier bleed-through. The validated
// allowlist + state builder live in lib/billing/features.ts, so a crafted
// payload can only ever toggle known catalog features.
const body = z.object({
  // tierId is accepted for backward compatibility (older clients/tests) but no
  // longer drives entitlements — the tier is inferred from the selection.
  tierId: z.enum(["starter", "growth", "scale"]).optional(),
  selectedModules: z.array(z.string().max(64)).max(40).optional(),
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

  const selected = parsed.selectedModules ?? [];
  const inferredTier = inferTierFromSelection(selected);

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

  // Exact à-la-carte module state from the selection. Always-on base modules
  // on, every selected catalog feature on, all other catalog features off.
  const moduleState = buildModuleStateFromSelection(selected);

  await prisma.organization.update({
    where: { id: user.orgId },
    data: {
      chosenTier: inferredTier as SubscriptionTier,
      subscriptionTier: inferredTier as SubscriptionTier,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialStartedAt,
      trialEndsAt,
      onboardingStep: "done",
      ...moduleState,
    },
  });

  return NextResponse.json({
    ok: true,
    nextStep: "done",
    tier: inferredTier,
    trialEndsAt: trialEndsAt.toISOString(),
  });
}
