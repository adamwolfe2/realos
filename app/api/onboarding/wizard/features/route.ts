import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { SubscriptionStatus, type SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildModuleStateFromSelection,
  inferTierFromSelection,
} from "@/lib/billing/features";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/features
//
// À-la-carte cart step. The operator picks the features they want; we write
// the EXACT module state to the org (always-on base + selected catalog
// features true, everything else false) and record the inferred billing tier.
// The trial does NOT start here — it starts after the properties step, so the
// operator lands in a fully-set-up workspace. Advances onboardingStep to
// "properties".
// ---------------------------------------------------------------------------

const body = z.object({
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

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, orgId: true },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "User not provisioned" },
      { status: 404 },
    );
  }

  const selected = parsed.selectedModules ?? [];
  const inferredTier = inferTierFromSelection(selected);
  const moduleState = buildModuleStateFromSelection(selected);

  // Entitlement write is gated on a NON-paid status (mirrors start-trial /
  // properties). A replayed or stale-tab features POST from an already
  // ACTIVE/PAST_DUE org must NOT overwrite its tier + module* flags to the
  // cart selection — that would silently dark-fire every paid module not in
  // the payload. NULL status = brand-new = eligible. (P1-4)
  await prisma.organization.updateMany({
    where: {
      id: user.orgId,
      OR: [
        { subscriptionStatus: null },
        {
          subscriptionStatus: {
            notIn: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
          },
        },
      ],
    },
    data: {
      chosenTier: inferredTier as SubscriptionTier,
      subscriptionTier: inferredTier as SubscriptionTier,
      ...moduleState,
    },
  });

  // "done" is terminal — don't let a stale features tab regress a completed
  // workspace back to "properties". Atomic conditional advance (no race);
  // count === 0 means it was already done. (launch-critical-sweep + Codex.)
  const advanced = await prisma.organization.updateMany({
    where: { id: user.orgId, NOT: { onboardingStep: "done" } },
    data: { onboardingStep: "properties" },
  });

  return NextResponse.json({
    ok: true,
    nextStep: advanced.count > 0 ? "properties" : "done",
    tier: inferredTier,
  });
}
