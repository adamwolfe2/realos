"use client";

// ---------------------------------------------------------------------------
// OnboardingStepper — the single setup surface on the dashboard.
//
// Carbon horizontal progress indicator (2026-07-09 Carbon rebuild). Replaces
// the four competing onboarding mechanisms that used to fight for the
// operator's attention on /portal:
//   - FirstRunOverlay (modal)          → active-step CTA points at /portal/connect
//   - OnboardingChecklistFloating      → same store + POST actions, inline not floating
//   - SetupWizardGate / SetupWizard    → FOUNDATION steps cover the same ground
//   - SetupBanner                      → header progress count
//
// Driven ONLY by data the page already fetches:
//   - `progress: ProgressSnapshot` from syncOnboardingProgress (canonical store)
//   - `connectStatus {connected,total}` → optional "· n/m sources connected" meta
//
// No dismissal, no localStorage, no overlay: server state hides it once
// currentPhase reaches COMPLETED (parent's existing `showChecklist` gate).
// ---------------------------------------------------------------------------

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  OnboardingPhase,
  OnboardingStepKey,
  OnboardingStepStatus,
} from "@prisma/client";
import {
  PHASE_STEPS,
  getPhaseProgress,
  type ProgressSnapshot,
} from "@/lib/onboarding/state-machine";
import { ArrowRight, Check, Minus } from "lucide-react";
import { StatusChip } from "@/components/portal/ui/status-chip";

type Props = {
  progress: ProgressSnapshot;
  connectStatus?: { connected: number; total: number };
};

const PHASE_LABELS: Record<Exclude<OnboardingPhase, "COMPLETED">, string> = {
  FOUNDATION: "Get the platform working",
  GROWTH: "Capture your first lead",
  POLISH: "Polish and expand",
};

const PHASE_ORDER: Array<Exclude<OnboardingPhase, "COMPLETED">> = [
  "FOUNDATION",
  "GROWTH",
  "POLISH",
];

// Lifted from the now-deleted onboarding-checklist-floating.tsx (the floating
// checklist this component replaced on the dashboard). INSTALL_PIXEL repointed
// to /portal/connect — the canonical connect hub hosts the pixel + GA4 flows.
const STEP_META: Record<
  OnboardingStepKey,
  { label: string; description: string; href: string }
> = {
  ADD_PROPERTY: {
    label: "Add at least one property",
    description: "Properties anchor leads, ads, and reporting.",
    href: "/portal/properties",
  },
  CONNECT_DATA_SOURCE: {
    label: "Connect a data source",
    description: "AppFolio, GA4, GSC, the Cursive pixel, or an ad account.",
    href: "/portal/connect",
  },
  CONFIRM_CONTACT_PREFS: {
    label: "Confirm contact preferences",
    description: "Set the email we use for alerts and reports.",
    href: "/portal/settings",
  },
  APPROVE_CHATBOT_PERSONA: {
    label: "Approve the chatbot persona",
    description: "Pick a greeting and tone before going live.",
    href: "/portal/chatbot",
  },
  INSTALL_PIXEL: {
    label: "Install the tracking pixel",
    description: "Drop the one-line script on your marketing site.",
    href: "/portal/connect",
  },
  VERIFY_LEAD_CAPTURE: {
    label: "Verify lead capture works",
    description: "Submit a test lead and confirm it lands in your inbox.",
    href: "/portal/leads",
  },
  CONNECT_ADS: {
    label: "Connect Google or Meta Ads",
    description: "Optional — skip if you don't run paid acquisition.",
    href: "/portal/ads",
  },
  REVIEW_FIRST_REPORT: {
    label: "Review your first weekly report",
    description: "Confirm the data looks right.",
    href: "/portal/reports",
  },
  SET_REPUTATION_QUERIES: {
    label: "Set reputation monitoring queries",
    description: "Scan Google, Reddit, Yelp for brand mentions.",
    href: "/portal/reputation",
  },
  CUSTOM_DOMAIN: {
    label: "Add a custom domain",
    description: "Run your tenant site on your own URL.",
    href: "/portal/settings",
  },
  WHITE_LABEL: {
    label: "Enable white-label workspace",
    description: "Swap LeaseStack branding for your own.",
    href: "/portal/settings",
  },
  GENERATE_NEIGHBORHOOD_PAGE: {
    label: "Publish a neighborhood landing page",
    description:
      "AI-drafts a long-form page about the neighborhood around your property — captures organic + AI-search traffic from people researching the area.",
    href: "/portal/seo/neighborhoods",
  },
  CUSTOM_REPORT_PREFS: {
    label: "Customize report cadence",
    description: "Pick how often the report ships and who receives it.",
    href: "/portal/reports/settings",
  },
  INVITE_TEAMMATE: {
    label: "Invite a teammate",
    description: "Bring leasing agents into the portal.",
    href: "/portal/settings",
  },
};

export function OnboardingStepper({ progress, connectStatus }: Props) {
  const router = useRouter();
  const phase = progress.currentPhase;
  const [busyStepKey, setBusyStepKey] =
    React.useState<OnboardingStepKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (phase === OnboardingPhase.COMPLETED) return null;

  const activePhase = phase as Exclude<OnboardingPhase, "COMPLETED">;
  const phaseProg = getPhaseProgress(progress, phase);
  const orderedKeys = PHASE_STEPS[activePhase];
  const stepsByKey = new Map(progress.steps.map((s) => [s.stepKey, s]));

  // Active step = first step in the phase that is neither completed nor
  // skipped. Connectors left of it render blue (done segments).
  const activeIndex = orderedKeys.findIndex((key) => {
    const step = stepsByKey.get(key);
    return (
      !step ||
      (step.status !== OnboardingStepStatus.COMPLETED &&
        step.status !== OnboardingStepStatus.SKIPPED)
    );
  });
  const effectiveActiveIndex =
    activeIndex === -1 ? orderedKeys.length : activeIndex;

  const phaseNumber = PHASE_ORDER.indexOf(activePhase) + 1;
  const phaseContext =
    activePhase === "FOUNDATION"
      ? "Growth and Polish unlock as you go."
      : activePhase === "GROWTH"
        ? "Polish unlocks as you go."
        : "Final phase.";

  // Same POST wiring as the floating checklist, but router.refresh()
  // instead of window.location.reload() — the parent server component
  // re-renders with the fresh ProgressSnapshot.
  async function handleAction(
    stepKey: OnboardingStepKey,
    action: "complete" | "skip",
  ) {
    setError(null);
    setBusyStepKey(stepKey);
    try {
      const body =
        action === "skip" ? { reason: "Marked not applicable by operator" } : {};
      const res = await fetch(
        `/api/portal/onboarding/steps/${stepKey}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyStepKey(null);
    }
  }

  return (
    <section
      aria-label="Setup progress"
      className="rounded-[2px] border border-[#e0e0e0] bg-white px-6 py-5"
    >
      {/* Header row: phase eyebrow left, tabular progress right. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#525252]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Setup · {PHASE_LABELS[activePhase]}
        </p>
        <p className="text-[11px] tabular-nums text-[#525252]">
          {phaseProg.completed} of {phaseProg.total}
          {connectStatus
            ? ` · ${connectStatus.connected}/${connectStatus.total} sources connected`
            : null}
        </p>
      </div>

      {/* Horizontal step track. */}
      <ol className="mt-4 flex overflow-x-auto" role="list">
        {orderedKeys.map((stepKey, i) => {
          const step = stepsByKey.get(stepKey);
          if (!step) return null;
          const meta = STEP_META[stepKey];
          const isCompleted = step.status === OnboardingStepStatus.COMPLETED;
          const isSkipped = step.status === OnboardingStepStatus.SKIPPED;
          const isDone = isCompleted || isSkipped;
          const isActive = i === effectiveActiveIndex;
          const isLast = i === orderedKeys.length - 1;
          const busy = busyStepKey === stepKey;

          return (
            <li
              key={stepKey}
              className="flex min-w-[120px] flex-1 flex-col gap-2"
            >
              {/* Marker + connector row. */}
              <div className="flex items-center">
                <span
                  aria-hidden="true"
                  className={
                    isCompleted
                      ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe] text-white"
                      : isSkipped
                        ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-[#e8e8e8] text-[#6f6f6f]"
                        : isActive
                          ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border-2 border-[#0f62fe] bg-white text-[12px] font-semibold tabular-nums text-[#0f62fe]"
                          : "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-[#c6c6c6] bg-white text-[12px] tabular-nums text-[#8d8d8d]"
                  }
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : isSkipped ? (
                    <Minus className="h-3 w-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className={`h-px flex-1 ${
                      i < effectiveActiveIndex
                        ? "bg-[#0f62fe]"
                        : "bg-[#e0e0e0]"
                    }`}
                  />
                ) : null}
              </div>

              {/* Label + state chip + active-step actions. */}
              <div className="min-w-0 pr-4">
                <Link
                  href={meta.href}
                  className={`block text-[12px] font-semibold leading-snug hover:underline ${
                    isDone ? "text-[#525252]" : "text-[#161616]"
                  }`}
                >
                  {meta.label}
                </Link>

                {isCompleted ? (
                  <StatusChip
                    status="live"
                    label="Done"
                    className="mt-1.5 hidden md:inline-flex"
                  />
                ) : null}

                {isActive ? (
                  <div className="mt-1.5 space-y-1.5">
                    <StatusChip status="connecting" label="In progress" />
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={meta.href}
                        className="inline-flex items-center gap-1 px-1 py-0.5 text-[11px] font-medium text-[#161616] hover:bg-[#f4f4f4] transition-colors"
                      >
                        Go
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAction(stepKey, "complete")}
                        className="inline-flex items-center rounded-none bg-[#0f62fe] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#0043ce] transition-colors disabled:opacity-50"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAction(stepKey, "skip")}
                        className="inline-flex items-center text-[11px] text-[#6f6f6f] hover:text-[#161616] transition-colors disabled:opacity-50"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Phase context + error. */}
      <p className="mt-3 text-[11px] text-[#6f6f6f]">
        Phase {phaseNumber} of 3 · {phaseContext}
      </p>
      {error ? (
        <p className="mt-1 text-[11px] text-[#da1e28]">{error}</p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// SetupSlimBar — the demoted setup surface. Carbon rebuild put the full
// horizontal step rail front-and-center on the dashboard; the Carbon-forward
// design pass demotes it to a single quiet line at the very bottom of the
// page, above the AppFolio status strip. Same underlying state (progress,
// active step, skip action) as OnboardingStepper — just one line instead of
// a rail of step boxes.
// ---------------------------------------------------------------------------

export function SetupSlimBar({ progress }: { progress: ProgressSnapshot }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const phase = progress.currentPhase;

  if (phase === OnboardingPhase.COMPLETED) return null;

  const activePhase = phase as Exclude<OnboardingPhase, "COMPLETED">;
  const phaseProg = getPhaseProgress(progress, phase);
  const orderedKeys = PHASE_STEPS[activePhase];
  const stepsByKey = new Map(progress.steps.map((s) => [s.stepKey, s]));

  const activeIndex = orderedKeys.findIndex((key) => {
    const step = stepsByKey.get(key);
    return (
      !step ||
      (step.status !== OnboardingStepStatus.COMPLETED &&
        step.status !== OnboardingStepStatus.SKIPPED)
    );
  });
  const activeStepKey =
    activeIndex === -1 ? null : orderedKeys[activeIndex];
  const activeMeta = activeStepKey ? STEP_META[activeStepKey] : null;

  async function skipActiveStep() {
    if (!activeStepKey) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/portal/onboarding/steps/${activeStepKey}/skip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Marked not applicable by operator" }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[2px] border border-[#e0e0e0] bg-white px-3 py-2">
      <Link
        href={activeMeta?.href ?? "/portal/settings"}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#525252] hover:text-[#161616] transition-colors min-w-0"
      >
        <span className="font-medium text-[#161616]">
          Setup {phaseProg.completed} of {phaseProg.total}
        </span>
        {activeMeta ? (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="truncate">{activeMeta.label}</span>
          </>
        ) : null}
        <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      </Link>
      {activeStepKey ? (
        <button
          type="button"
          disabled={busy}
          onClick={skipActiveStep}
          className="text-[11px] text-[#6f6f6f] hover:text-[#161616] transition-colors disabled:opacity-50"
        >
          Skip
        </button>
      ) : null}
      {error ? (
        <p className="w-full text-[11px] text-[#da1e28]">{error}</p>
      ) : null}
    </div>
  );
}
