// ---------------------------------------------------------------------------
// LeaseStack onboarding wizard — step definitions and progression.
//
// Each new user passes through three steps before landing in the portal:
//
//   1. welcome   — workspace name + property type
//   2. property  — add the first property
//   3. plan      — pick a tier and start the 14-day trial
//
// State persists on Organization.onboardingStep so the user can close the
// tab and resume on the right step. The portal middleware redirects any
// user with `onboardingStep != "done"` back to the wizard.
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS = [
  "welcome",
  "property",
  "plan",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function nextStep(current: OnboardingStep): OnboardingStep {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return "done";
  return ONBOARDING_STEPS[idx + 1]!;
}

export function isValidStep(s: string | null | undefined): s is OnboardingStep {
  return !!s && (ONBOARDING_STEPS as readonly string[]).includes(s);
}

// Resolve which step the user should be on, given what they've got
// persisted. New users without a step yet start at "welcome".
export function resolveCurrentStep(
  raw: string | null | undefined,
): OnboardingStep {
  if (!raw) return "welcome";
  return isValidStep(raw) ? raw : "welcome";
}

// Trial window for newly-activated workspaces. 14 days from the moment
// the user clears the plan step.
export const TRIAL_DAYS = 14;

export function computeTrialEndsAt(startedAt: Date = new Date()): Date {
  const end = new Date(startedAt);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}
