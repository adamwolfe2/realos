import { describe, it, expect, vi } from "vitest";
import {
  OnboardingPhase,
  OnboardingStepKey,
  OnboardingStepStatus,
} from "@prisma/client";

// Existing orgs keep a PENDING row for retired steps (INSTALL_PIXEL). Those
// rows can't be completed or skipped from the UI anymore, so they must not
// hold the phase at "N-1 of N".

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { getPhaseProgress, PHASE_STEPS } = await import(
  "@/lib/onboarding/state-machine"
);

function row(stepKey: OnboardingStepKey, status: OnboardingStepStatus) {
  return {
    stepKey,
    phase: OnboardingPhase.FOUNDATION,
    status,
    completedAt: null,
    skippedAt: null,
    skippedReason: null,
    metadata: null,
  };
}

const snapshot = (steps: ReturnType<typeof row>[]) => ({
  id: "p1",
  orgId: "o1",
  currentPhase: OnboardingPhase.FOUNDATION,
  foundationStartedAt: null,
  foundationCompletedAt: null,
  growthStartedAt: null,
  growthCompletedAt: null,
  polishStartedAt: null,
  completedAt: null,
  steps,
});

describe("onboarding progress ignores retired steps", () => {
  it("does not count a stale PENDING INSTALL_PIXEL row", () => {
    const done = PHASE_STEPS.FOUNDATION.map((k) =>
      row(k, OnboardingStepStatus.COMPLETED),
    );
    const stale = row(OnboardingStepKey.INSTALL_PIXEL, OnboardingStepStatus.PENDING);

    const p = getPhaseProgress(snapshot([...done, stale]), OnboardingPhase.FOUNDATION);

    expect(p).toEqual({ completed: done.length, total: done.length, pct: 100 });
  });

  it("still counts a pending current step", () => {
    const [first, ...rest] = PHASE_STEPS.FOUNDATION;
    const steps = [
      row(first, OnboardingStepStatus.PENDING),
      ...rest.map((k) => row(k, OnboardingStepStatus.COMPLETED)),
    ];

    const p = getPhaseProgress(snapshot(steps), OnboardingPhase.FOUNDATION);

    expect(p.completed).toBe(rest.length);
    expect(p.total).toBe(PHASE_STEPS.FOUNDATION.length);
  });
});
