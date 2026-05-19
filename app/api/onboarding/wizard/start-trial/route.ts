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

// Whitelist of module flag keys we accept from the picker. Keep in sync
// with the PICKER_MODULES list in components/onboarding/plan-step.tsx.
// Anything not in this set is silently dropped — operators can't sneak
// extra entitlements through a crafted payload.
const ALLOWED_MODULE_KEYS = new Set<string>([
  "moduleChatbot",
  "modulePixel",
  "moduleGoogleAds",
  "moduleMetaAds",
  "moduleSEO",
  "moduleCreativeStudio",
  "moduleReferrals",
  "moduleEmail",
  "moduleOutboundEmail",
  "modulePopups",
  // Always-on modules are accepted as no-ops (the tier defaults already
  // set them true). Listing them here keeps the picker payload schema
  // lenient if the client sends them through.
  "moduleWebsite",
  "moduleLeadCapture",
]);

type ModuleFlagPatch = Partial<Record<string, boolean>>;

function buildModulePatch(selectedModules: string[]): ModuleFlagPatch {
  const patch: ModuleFlagPatch = {};
  for (const key of selectedModules) {
    if (!ALLOWED_MODULE_KEYS.has(key)) continue;
    if (!key.startsWith("module")) continue;
    patch[key] = true;
  }
  return patch;
}

const body = z.object({
  tierId: z.enum(["starter", "growth", "scale"]),
  // Optional for backwards compatibility — older clients (and tests)
  // may still send just { tierId }. Default to an empty list and let
  // the tier defaults do the work.
  selectedModules: z.array(z.string().max(64)).max(20).optional(),
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

  // Tier defaults plus the operator's hand-picked extras. Tier defaults
  // win on conflicts (you can't downgrade a tier-included module to off
  // through the picker). Picker can only add modules on top.
  const tierModules = getModulesForTier(tierDef.tier) ?? {};
  const pickerPatch = buildModulePatch(parsed.selectedModules ?? []);
  const mergedModules = { ...tierModules, ...pickerPatch };

  await prisma.organization.update({
    where: { id: user.orgId },
    data: {
      chosenTier: tierDef.tier as SubscriptionTier,
      subscriptionTier: tierDef.tier as SubscriptionTier,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialStartedAt,
      trialEndsAt,
      onboardingStep: "done",
      ...mergedModules,
    },
  });

  return NextResponse.json({
    ok: true,
    nextStep: "done",
    trialEndsAt: trialEndsAt.toISOString(),
  });
}
