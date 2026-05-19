// ---------------------------------------------------------------------------
// Self-serve onboarding state machine — three phases, 14 steps.
//
// FOUNDATION  (week 1, time-bounded) — platform working state
// GROWTH      (week 2, time-bounded) — first lead captured state
// POLISH      (anytime, NOT auto-completed) — optional enhancements
//
// Lazy-initialized on first /portal landing. Phase advances automatically
// when every NON-SKIPPED step in the active phase flips COMPLETED.
// Skipped steps count as completed for advancement, so an operator that
// genuinely doesn't run paid ads can SKIP `CONNECT_ADS` and still clear
// Growth.
//
// FOUNDATION → GROWTH → POLISH advances automatically.
// POLISH → COMPLETED is OPT-IN — the polish phase stays open indefinitely
// unless every polish step is COMPLETED or SKIPPED, in which case we flip
// `currentPhase = COMPLETED` and stamp `completedAt`. This matches the
// "anytime, not time-bounded" rule (we never nag past POLISH).
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import {
  OnboardingPhase,
  OnboardingStepKey,
  OnboardingStepStatus,
  Prisma,
} from "@prisma/client";

// Canonical phase → step list. Iteration order = display order on the
// operator checklist. Keep parallel with prisma/schema.prisma enums.
export const PHASE_STEPS: Record<
  Exclude<OnboardingPhase, "COMPLETED">,
  ReadonlyArray<OnboardingStepKey>
> = {
  FOUNDATION: [
    OnboardingStepKey.ADD_PROPERTY,
    OnboardingStepKey.CONNECT_DATA_SOURCE,
    OnboardingStepKey.CONFIRM_CONTACT_PREFS,
    OnboardingStepKey.APPROVE_CHATBOT_PERSONA,
    OnboardingStepKey.INSTALL_PIXEL,
  ],
  GROWTH: [
    OnboardingStepKey.VERIFY_LEAD_CAPTURE,
    OnboardingStepKey.CONNECT_ADS,
    OnboardingStepKey.REVIEW_FIRST_REPORT,
    OnboardingStepKey.SET_REPUTATION_QUERIES,
  ],
  POLISH: [
    OnboardingStepKey.CUSTOM_DOMAIN,
    OnboardingStepKey.WHITE_LABEL,
    OnboardingStepKey.GENERATE_NEIGHBORHOOD_PAGE,
    OnboardingStepKey.CUSTOM_REPORT_PREFS,
    OnboardingStepKey.INVITE_TEAMMATE,
  ],
} as const;

// Reverse map for "given a step, which phase does it live in?" lookups.
export const STEP_PHASE: Record<OnboardingStepKey, OnboardingPhase> = (() => {
  const out = {} as Record<OnboardingStepKey, OnboardingPhase>;
  for (const [phase, steps] of Object.entries(PHASE_STEPS) as Array<
    [Exclude<OnboardingPhase, "COMPLETED">, ReadonlyArray<OnboardingStepKey>]
  >) {
    for (const s of steps) out[s] = phase;
  }
  return out;
})();

export const PHASE_ORDER: ReadonlyArray<OnboardingPhase> = [
  OnboardingPhase.FOUNDATION,
  OnboardingPhase.GROWTH,
  OnboardingPhase.POLISH,
  OnboardingPhase.COMPLETED,
];

export type StepRecord = {
  stepKey: OnboardingStepKey;
  phase: OnboardingPhase;
  status: OnboardingStepStatus;
  completedAt: Date | null;
  skippedAt: Date | null;
  skippedReason: string | null;
  metadata: Prisma.JsonValue | null;
};

export type ProgressSnapshot = {
  id: string;
  orgId: string;
  currentPhase: OnboardingPhase;
  foundationStartedAt: Date | null;
  foundationCompletedAt: Date | null;
  growthStartedAt: Date | null;
  growthCompletedAt: Date | null;
  polishStartedAt: Date | null;
  completedAt: Date | null;
  steps: StepRecord[];
};

// ---------------------------------------------------------------------------
// Lazy initializer. Creates the OnboardingProgress row + 14 PENDING step
// rows on first call. Idempotent — subsequent calls just return the
// existing row, no writes.
// ---------------------------------------------------------------------------
export async function getOrInitOnboardingProgress(
  orgId: string,
): Promise<ProgressSnapshot> {
  const existing = await prisma.onboardingProgress.findUnique({
    where: { orgId },
    include: {
      steps: {
        orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (existing) return toSnapshot(existing);

  // Build the 14 PENDING step rows in one nested create.
  const stepCreateInputs: Prisma.OnboardingStepProgressCreateWithoutProgressInput[] =
    [];
  for (const [phase, steps] of Object.entries(PHASE_STEPS) as Array<
    [Exclude<OnboardingPhase, "COMPLETED">, ReadonlyArray<OnboardingStepKey>]
  >) {
    for (const stepKey of steps) {
      stepCreateInputs.push({
        phase,
        stepKey,
        status: OnboardingStepStatus.PENDING,
      });
    }
  }

  const created = await prisma.onboardingProgress.create({
    data: {
      orgId,
      currentPhase: OnboardingPhase.FOUNDATION,
      foundationStartedAt: new Date(),
      steps: { create: stepCreateInputs },
    },
    include: {
      steps: {
        orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return toSnapshot(created);
}

// ---------------------------------------------------------------------------
// Mark a single step as COMPLETED. No-op if already COMPLETED. After write,
// re-evaluates whether the step's phase is fully cleared and advances
// currentPhase accordingly.
//
// metadata is appended (shallow-merge) onto the existing metadata blob so
// repeated detector runs don't clobber prior provenance.
// ---------------------------------------------------------------------------
export async function markStepCompleted(
  orgId: string,
  stepKey: OnboardingStepKey,
  metadata?: Record<string, unknown>,
): Promise<ProgressSnapshot> {
  const progress = await getOrInitOnboardingProgress(orgId);
  const step = progress.steps.find((s) => s.stepKey === stepKey);
  if (!step) {
    // Should never happen — init seeds all 14. Guard anyway.
    throw new Error(`Unknown onboarding step: ${stepKey}`);
  }

  if (step.status === OnboardingStepStatus.COMPLETED) {
    return progress;
  }

  const mergedMeta = mergeMetadata(step.metadata, metadata);

  await prisma.onboardingStepProgress.update({
    where: { progressId_stepKey: { progressId: progress.id, stepKey } },
    data: {
      status: OnboardingStepStatus.COMPLETED,
      completedAt: new Date(),
      metadata: mergedMeta,
    },
  });

  return await advancePhaseIfReady(orgId);
}

// ---------------------------------------------------------------------------
// Mark a single step as SKIPPED (with reason). Treated as "complete enough"
// for phase advancement. No-op if already SKIPPED.
// ---------------------------------------------------------------------------
export async function skipStep(
  orgId: string,
  stepKey: OnboardingStepKey,
  reason: string,
): Promise<ProgressSnapshot> {
  const progress = await getOrInitOnboardingProgress(orgId);
  const step = progress.steps.find((s) => s.stepKey === stepKey);
  if (!step) throw new Error(`Unknown onboarding step: ${stepKey}`);

  if (step.status === OnboardingStepStatus.SKIPPED) return progress;

  await prisma.onboardingStepProgress.update({
    where: { progressId_stepKey: { progressId: progress.id, stepKey } },
    data: {
      status: OnboardingStepStatus.SKIPPED,
      skippedAt: new Date(),
      skippedReason: reason.slice(0, 500), // cap at column-friendly length
    },
  });

  return await advancePhaseIfReady(orgId);
}

// ---------------------------------------------------------------------------
// Returns { completed, total, pct } for the given phase. Skipped counts as
// completed (consistent with phase-advancement rule).
// ---------------------------------------------------------------------------
export function getPhaseProgress(
  snapshot: ProgressSnapshot,
  phase: OnboardingPhase,
): { completed: number; total: number; pct: number } {
  if (phase === OnboardingPhase.COMPLETED) {
    return { completed: 1, total: 1, pct: 100 };
  }
  const stepsInPhase = snapshot.steps.filter((s) => s.phase === phase);
  const total = stepsInPhase.length;
  const completed = stepsInPhase.filter(
    (s) =>
      s.status === OnboardingStepStatus.COMPLETED ||
      s.status === OnboardingStepStatus.SKIPPED,
  ).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, pct };
}

// ---------------------------------------------------------------------------
// Re-reads progress, checks whether the current phase is fully cleared, and
// advances. Returns the (possibly updated) snapshot.
//
// Advancement rules:
//   FOUNDATION done → GROWTH (stamp growthStartedAt + foundationCompletedAt)
//   GROWTH done     → POLISH (stamp polishStartedAt + growthCompletedAt)
//   POLISH done     → COMPLETED (stamp completedAt). POLISH only advances
//                     when EVERY polish step is COMPLETED/SKIPPED. Otherwise
//                     stays in POLISH indefinitely (the "anytime" rule).
// ---------------------------------------------------------------------------
async function advancePhaseIfReady(orgId: string): Promise<ProgressSnapshot> {
  const fresh = await prisma.onboardingProgress.findUnique({
    where: { orgId },
    include: {
      steps: { orderBy: [{ phase: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!fresh) throw new Error(`OnboardingProgress missing for org ${orgId}`);

  const snap = toSnapshot(fresh);

  if (snap.currentPhase === OnboardingPhase.COMPLETED) return snap;

  const phaseDone =
    snap.currentPhase === OnboardingPhase.FOUNDATION
      ? isPhaseDone(snap, OnboardingPhase.FOUNDATION)
      : snap.currentPhase === OnboardingPhase.GROWTH
        ? isPhaseDone(snap, OnboardingPhase.GROWTH)
        : isPhaseDone(snap, OnboardingPhase.POLISH);

  if (!phaseDone) return snap;

  const now = new Date();
  const update: Prisma.OnboardingProgressUpdateInput = {};

  if (snap.currentPhase === OnboardingPhase.FOUNDATION) {
    update.foundationCompletedAt = now;
    update.growthStartedAt = now;
    update.currentPhase = OnboardingPhase.GROWTH;
  } else if (snap.currentPhase === OnboardingPhase.GROWTH) {
    update.growthCompletedAt = now;
    update.polishStartedAt = now;
    update.currentPhase = OnboardingPhase.POLISH;
  } else if (snap.currentPhase === OnboardingPhase.POLISH) {
    // Only auto-complete when every polish step is COMPLETED/SKIPPED.
    // isPhaseDone already enforced that — flip to COMPLETED.
    update.completedAt = now;
    update.currentPhase = OnboardingPhase.COMPLETED;
  }

  const updated = await prisma.onboardingProgress.update({
    where: { orgId },
    data: update,
    include: {
      steps: { orderBy: [{ phase: "asc" }, { createdAt: "asc" }] },
    },
  });

  // Chain — completing one phase may have made the next instantly empty
  // (e.g. if a hypothetical future change ever shipped a phase with zero
  // gating steps). Re-call to converge.
  if (updated.currentPhase !== snap.currentPhase) {
    return await advancePhaseIfReady(orgId);
  }
  return toSnapshot(updated);
}

function isPhaseDone(
  snapshot: ProgressSnapshot,
  phase: Exclude<OnboardingPhase, "COMPLETED">,
): boolean {
  const stepsInPhase = snapshot.steps.filter((s) => s.phase === phase);
  if (stepsInPhase.length === 0) return true;
  return stepsInPhase.every(
    (s) =>
      s.status === OnboardingStepStatus.COMPLETED ||
      s.status === OnboardingStepStatus.SKIPPED,
  );
}

function mergeMetadata(
  existing: Prisma.JsonValue | null,
  incoming: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!incoming || Object.keys(incoming).length === 0) {
    return existing == null
      ? undefined
      : (existing as Prisma.InputJsonValue);
  }
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...incoming } as Prisma.InputJsonValue;
}

type ProgressWithSteps = Prisma.OnboardingProgressGetPayload<{
  include: { steps: true };
}>;

function toSnapshot(row: ProgressWithSteps): ProgressSnapshot {
  return {
    id: row.id,
    orgId: row.orgId,
    currentPhase: row.currentPhase,
    foundationStartedAt: row.foundationStartedAt,
    foundationCompletedAt: row.foundationCompletedAt,
    growthStartedAt: row.growthStartedAt,
    growthCompletedAt: row.growthCompletedAt,
    polishStartedAt: row.polishStartedAt,
    completedAt: row.completedAt,
    steps: row.steps.map((s) => ({
      stepKey: s.stepKey,
      phase: s.phase,
      status: s.status,
      completedAt: s.completedAt,
      skippedAt: s.skippedAt,
      skippedReason: s.skippedReason,
      metadata: s.metadata,
    })),
  };
}
