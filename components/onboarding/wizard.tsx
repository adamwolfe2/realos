"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
  SubscriptionTier,
} from "@prisma/client";
import type { OnboardingStep } from "@/lib/onboarding/steps";
import { WizardChrome } from "./wizard-chrome";
import { WelcomeStep } from "./welcome-step";
import { FeaturesStep } from "./features-step";
import { PropertiesStep, type PropertiesStepInitial } from "./properties-step";
import type { FeatureDef } from "@/lib/billing/features";

// ---------------------------------------------------------------------------
// Top-level wizard host. Renders a chrome (progress dots + brand mark)
// and the current step. The server resolves which step to show based on
// Organization.onboardingStep; this component owns no routing state,
// just step-internal form state.
//
// On step completion we call the matching /api/onboarding/wizard/*
// endpoint, which persists state + bumps onboardingStep, then we
// router.refresh() so the server-side page re-resolves the step and
// renders the next one. This keeps "what step am I on" as a single
// source of truth in the DB; closing the tab is safe.
// ---------------------------------------------------------------------------

export type OnboardingOrg = {
  id: string;
  name: string;
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
  chosenTier: SubscriptionTier | null;
};

export type OnboardingProperty = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
} | null;

export function OnboardingWizard({
  step,
  org,
  properties,
  featureCatalog,
  savedFeatureSelection,
}: {
  step: OnboardingStep;
  org: OnboardingOrg;
  properties: PropertiesStepInitial;
  // Effective (admin-priced) feature catalog, resolved server-side.
  featureCatalog: { features: FeatureDef[]; basePlatformCents: number };
  // The operator's saved feature selection (module keys) when they've already
  // completed the features step — so navigating back restores it instead of
  // resetting to recommended. undefined on first visit.
  savedFeatureSelection?: string[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const goBack = React.useCallback(async () => {
    // Norman feedback (2026-06-02): wizard had no step-back nav. POSTs
    // to /api/onboarding/wizard/back which decrements the persisted
    // step. We share the `submitting` lock so a click during an
    // in-flight save doesn't double-mutate the step.
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/wizard/back", {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Couldn't go back. Try again.");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Network error. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }, [router, submitting]);

  const advance = React.useCallback(
    async (
      action: "workspace" | "features" | "properties",
      body: unknown,
    ) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch(`/api/onboarding/wizard/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          toast.error(
            json?.error ?? `Couldn't save (HTTP ${res.status}). Try again.`,
          );
          return;
        }
        // The page re-fetches its data on refresh() and renders the
        // newly-advanced step. start-trial transitions land at the
        // dedicated /portal/welcome page so the operator sees an
        // explicit welcome card + next-steps before the dashboard takes
        // over (Norman feedback 2026-06-02).
        if (json.nextStep === "done") {
          router.push("/portal/welcome");
        } else {
          router.refresh();
        }
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Network error. Try again in a moment.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [router, submitting],
  );

  return (
    <WizardChrome step={step} onBack={goBack} backDisabled={submitting}>
      {submitting ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ backgroundColor: "rgba(245,244,237,0.7)" }}
        >
          <Loader2
            className="h-6 w-6 animate-spin"
            style={{ color: "#2563EB" }}
            aria-hidden="true"
          />
        </div>
      ) : null}

      {step === "welcome" ? (
        <WelcomeStep
          initial={{
            name: org.name,
            propertyType: org.propertyType,
            residentialSubtype: org.residentialSubtype,
            commercialSubtype: org.commercialSubtype,
          }}
          onSubmit={(body) => advance("workspace", body)}
          disabled={submitting}
        />
      ) : null}

      {step === "features" ? (
        <FeaturesStep
          features={featureCatalog.features}
          basePlatformCents={featureCatalog.basePlatformCents}
          initialSelected={savedFeatureSelection}
          onSubmit={(body) => advance("features", body)}
          disabled={submitting}
        />
      ) : null}

      {step === "properties" ? (
        <PropertiesStep
          initial={properties}
          onSubmit={(body) => advance("properties", body)}
          disabled={submitting}
        />
      ) : null}
      {/* features → /api/onboarding/wizard/features writes the à-la-carte
          module state (no tier bleed-through). properties →
          /api/onboarding/wizard/properties creates the property rows, records
          the CRM choice, starts the 14-day trial, and finishes onboarding. */}
    </WizardChrome>
  );
}
