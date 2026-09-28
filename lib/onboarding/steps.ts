// ---------------------------------------------------------------------------
// LeaseStack onboarding wizard — step definitions and progression.
//
// Each new user passes through four steps before landing in the portal:
//
//   1. welcome       workspace name + property type
//   2. integrations  connect a PMS (AppFolio live; Yardi/Buildium/Entrata/
//                    RealPage scaffolded for "coming soon" interest
//                    collection) or pick manual entry
//   3. property      add the first property (skipped automatically when
//                    a PMS import populated it)
//   4. plan          pick a tier and start the 14-day trial
//
// State persists on Organization.onboardingStep so the user can close
// the tab and resume on the right step. The portal middleware redirects
// any user with `onboardingStep != "done"` back to the wizard.
// ---------------------------------------------------------------------------

// New à-la-carte order (slice S2): name the workspace, build a feature cart,
// then add the properties those features run on, then land in the workspace
// with the 14-day trial active. CRM/PMS choice lives inside the properties
// step (with a "No CRM — set up manually" option), so there's no standalone
// integrations step anymore.
export const ONBOARDING_STEPS = [
  "welcome",
  "features",
  "properties",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function nextStep(current: OnboardingStep): OnboardingStep {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return "done";
  return ONBOARDING_STEPS[idx + 1]!;
}

/**
 * Mirror of nextStep for going backward. Norman feedback (2026-06-02):
 * the wizard had no step-back navigation — hitting browser-back dropped
 * users on the landing page because the wizard's "state" is server-
 * persisted, not URL-routed. The back button in the chrome calls
 * /api/onboarding/wizard/back which decrements via this helper.
 *
 * `welcome` is the first step; trying to go back from there returns
 * `welcome` (no-op). `done` is TERMINAL — a finished, trialing customer
 * has no "back": returning `done` keeps the no-op contract and prevents a
 * stale/replayed back-press from regressing them into the wizard (P1-3).
 */
export function previousStep(current: OnboardingStep): OnboardingStep {
  // Terminal state has no predecessor — never walk a completed org backward.
  if (current === "done") return "done";
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx <= 0) return "welcome";
  return ONBOARDING_STEPS[idx - 1]!;
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

// Go-live trial (plans/go-live-trial): the 14-day clock starts when the
// workspace goes live (lib/billing/go-live-trial.ts), capped at 30 days from
// signup. Until go-live the stored trialEndsAt is the 30-day setup window.
export const TRIAL_DAYS = 14;
export const TRIAL_CAP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeTrialEndsAt(startedAt: Date = new Date()): Date {
  return new Date(startedAt.getTime() + TRIAL_CAP_DAYS * DAY_MS);
}

export function addTrialDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
