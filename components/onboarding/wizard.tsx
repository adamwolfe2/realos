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
import { PropertyStep } from "./property-step";
import { PlanStep } from "./plan-step";

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
  firstProperty,
}: {
  step: OnboardingStep;
  org: OnboardingOrg;
  firstProperty: OnboardingProperty;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const advance = React.useCallback(
    async (action: "workspace" | "property" | "start-trial", body: unknown) => {
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
        // newly-advanced step. If we just hit start-trial, the server
        // page redirects to /portal because onboardingStep === "done".
        if (json.nextStep === "done") {
          router.push("/portal?welcome=1");
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
    <WizardChrome step={step}>
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

      {step === "property" ? (
        <PropertyStep
          initial={firstProperty}
          orgPropertyType={org.propertyType}
          onSubmit={(body) => advance("property", body)}
          disabled={submitting}
        />
      ) : null}

      {step === "plan" ? (
        <PlanStep
          chosenTier={org.chosenTier}
          onSubmit={(body) => advance("start-trial", body)}
          disabled={submitting}
        />
      ) : null}
    </WizardChrome>
  );
}
