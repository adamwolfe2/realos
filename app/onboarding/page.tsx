import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { BRAND_NAME } from "@/lib/brand";
import { resolveCurrentStep } from "@/lib/onboarding/steps";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { getEffectiveFeatureCatalog } from "@/lib/billing/feature-prices";
import { FEATURE_CATALOG } from "@/lib/billing/features";

// ---------------------------------------------------------------------------
// /onboarding — the self-serve, trial-first signup wizard.
//
// Replaces the legacy IntakeWizard (which was a sales-call intake form).
// This is the actual product onboarding: a signed-in user lands here
// right after Clerk signup, walks through three steps (workspace,
// property, plan), and lands in the portal with a 14-day trial active.
//
// State persists on Organization.onboardingStep so closing the tab is
// safe; the page reads the field on every load and renders the right
// step. When onboardingStep === "done", we redirect to /portal.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Get started with ${BRAND_NAME}`,
  description:
    "Set up your workspace, add your first property, and start a 14-day free trial. No card required.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-up?redirect_url=/onboarding");
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      org: {
        select: {
          id: true,
          name: true,
          propertyType: true,
          residentialSubtype: true,
          commercialSubtype: true,
          onboardingStep: true,
          chosenTier: true,
          trialStartedAt: true,
          subscriptionStatus: true,
          // Module flags → reconstruct the operator's saved feature selection so
          // navigating back to the features step restores it. (Codex.)
          moduleChatbot: true,
          modulePixel: true,
          moduleSEO: true,
          moduleReputation: true,
          moduleGoogleAds: true,
          moduleMetaAds: true,
          modulePopups: true,
          moduleCreativeStudio: true,
          moduleEmail: true,
          moduleOutboundEmail: true,
          moduleReferrals: true,
          moduleInsights: true,
          moduleMarketIntelligence: true,
          moduleAttribution: true,
          properties: {
            where: { lifecycle: { in: ["IMPORTED", "ACTIVE"] } },
            orderBy: { createdAt: "asc" },
            take: 99,
            select: { name: true, city: true, state: true },
          },
        },
      },
    },
  });

  if (!user || !user.org) {
    // Scope-helper auto-provisions on /portal — bounce there so a User +
    // Organization get created, then redirect back here.
    redirect("/portal");
  }

  if (user.org.onboardingStep === "done") {
    redirect("/portal");
  }

  const step = resolveCurrentStep(user.org.onboardingStep);
  // Admin-editable feature prices drive the cart's running total.
  const featureCatalog = await getEffectiveFeatureCatalog();

  // Reconstruct the operator's saved feature selection from the org module
  // flags, but ONLY once they've actually submitted the features step
  // (chosenTier gets set there). Before that, leave it undefined so the cart
  // shows the recommended starter package. (Codex onboarding review.)
  // Only restore features that are STILL in the active (admin-priced) catalog —
  // a feature deactivated after the operator picked it must not silently stay
  // counted/submitted/enabled. (Codex.)
  const orgRecord = user.org as Record<string, unknown>;
  const activeFeatureKeys = new Set(
    featureCatalog.features.map((f) => f.key as string),
  );
  const savedFeatureSelection = user.org.chosenTier
    ? FEATURE_CATALOG.filter(
        (f) => orgRecord[f.key] === true && activeFeatureKeys.has(f.key as string),
      ).map((f) => f.key as string)
    : undefined;

  return (
    <OnboardingWizard
      step={step}
      featureCatalog={featureCatalog}
      savedFeatureSelection={savedFeatureSelection}
      org={{
        id: user.org.id,
        name: user.org.name,
        propertyType: user.org.propertyType,
        residentialSubtype: user.org.residentialSubtype,
        commercialSubtype: user.org.commercialSubtype,
        chosenTier: user.org.chosenTier,
      }}
      properties={user.org.properties.map((p) => ({
        name: p.name,
        city: p.city,
        state: p.state,
      }))}
    />
  );
}
