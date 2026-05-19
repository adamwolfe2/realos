"use client";

// ---------------------------------------------------------------------------
// OnboardingChecklist — operator-facing progress card on /portal.
//
// Renders the current phase, a step list with status icons, and per-step
// "go to step" / "mark as done" / "skip" affordances. Collapsible — the
// operator can hide the body if they want to focus on the dashboard, but
// the card itself stays mounted until POLISH completes.
//
// The detector library already auto-completes most steps via background
// sync. The manual mark-done / skip affordances exist because some steps
// (CONFIRM_CONTACT_PREFS, APPROVE_CHATBOT_PERSONA) gate on operator
// affirmation, and because the detector lag can confuse — e.g. the
// operator just installed the pixel but no webhook has landed yet.
// ---------------------------------------------------------------------------

import * as React from "react";
import Link from "next/link";
import {
  OnboardingPhase,
  OnboardingStepKey,
  OnboardingStepStatus,
} from "@prisma/client";
import {
  PHASE_STEPS,
  getPhaseProgress,
  type ProgressSnapshot,
  type StepRecord,
} from "@/lib/onboarding/state-machine";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  ArrowRight,
  X as XIcon,
} from "lucide-react";

type Props = {
  progress: ProgressSnapshot;
};

const PHASE_LABELS: Record<Exclude<OnboardingPhase, "COMPLETED">, string> = {
  FOUNDATION: "Week 1 — get the platform working",
  GROWTH: "Week 2 — capture your first lead",
  POLISH: "Anytime — polish and expand",
};

// Step metadata. `href` is verified against real /portal routes; `label`
// shows in the checklist; `description` is the supporting copy.
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
    label: "Confirm contact + notification preferences",
    description:
      "Set the email we use for alerts, reports, and operator updates.",
    href: "/portal/settings",
  },
  APPROVE_CHATBOT_PERSONA: {
    label: "Approve the AI chatbot persona",
    description: "Pick a greeting and tone before going live.",
    href: "/portal/chatbot",
  },
  INSTALL_PIXEL: {
    label: "Install the tracking pixel",
    description:
      "Drop the one-line script on your marketing site to start identifying visitors.",
    href: "/portal/settings/integrations",
  },
  VERIFY_LEAD_CAPTURE: {
    label: "Verify lead capture works",
    description: "Submit a test lead and confirm it lands in your inbox.",
    href: "/portal/leads",
  },
  CONNECT_ADS: {
    label: "Connect Google Ads or Meta Ads",
    description: "Optional — skip if you don't run paid acquisition.",
    href: "/portal/ads",
  },
  REVIEW_FIRST_REPORT: {
    label: "Review your first weekly report",
    description: "We generate it for you — confirm the data looks right.",
    href: "/portal/reports",
  },
  SET_REPUTATION_QUERIES: {
    label: "Set reputation monitoring queries",
    description:
      "We'll scan Google, Reddit, Yelp, and the web for brand mentions.",
    href: "/portal/reputation",
  },
  CUSTOM_DOMAIN: {
    label: "Add a custom domain",
    description: "Run your tenant site on your own URL.",
    href: "/portal/settings",
  },
  WHITE_LABEL: {
    label: "Enable white-label workspace",
    description: "Swap LeaseStack branding for your own across the workspace.",
    href: "/portal/settings",
  },
  GENERATE_NEIGHBORHOOD_PAGE: {
    label: "Generate a neighborhood landing page",
    description:
      "AI-written SEO + AEO pages anchored to a specific neighborhood.",
    href: "/portal/seo",
  },
  CUSTOM_REPORT_PREFS: {
    label: "Customize your report cadence",
    description: "Tune frequency and recipients of automated reports.",
    href: "/portal/reports",
  },
  INVITE_TEAMMATE: {
    label: "Invite a teammate",
    description: "Bring leasing agents or your marketing lead into the portal.",
    href: "/portal/settings",
  },
};

export function OnboardingChecklist({ progress }: Props) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [busyStepKey, setBusyStepKey] =
    React.useState<OnboardingStepKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const phase = progress.currentPhase;
  if (phase === OnboardingPhase.COMPLETED) return null;

  const phaseProg = getPhaseProgress(progress, phase);
  const orderedKeys = PHASE_STEPS[phase];
  const stepsByKey = new Map(progress.steps.map((s) => [s.stepKey, s]));

  async function handleAction(
    stepKey: OnboardingStepKey,
    action: "complete" | "skip",
  ) {
    setError(null);
    setBusyStepKey(stepKey);
    try {
      const body =
        action === "skip"
          ? { reason: "Marked not applicable by operator" }
          : {};
      const res = await fetch(
        `/api/portal/onboarding/steps/${stepKey}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      // Server action mutates DB but this component renders from server
      // state; trigger a soft refresh.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyStepKey(null);
    }
  }

  return (
    <section
      aria-label="Onboarding checklist"
      className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/[0.04] p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
              {phase}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {phaseProg.completed} of {phaseProg.total} done
            </span>
          </div>
          <h2 className="text-base font-semibold tracking-tight text-foreground leading-tight">
            {PHASE_LABELS[phase as Exclude<OnboardingPhase, "COMPLETED">]}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show steps" : "Hide"}
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
      </header>

      <div
        aria-hidden="true"
        className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden"
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${phaseProg.pct}%` }}
        />
      </div>

      {!collapsed ? (
        <ol className="mt-4 space-y-1.5">
          {orderedKeys.map((stepKey) => {
            const step = stepsByKey.get(stepKey);
            if (!step) return null;
            return (
              <StepRow
                key={stepKey}
                step={step}
                busy={busyStepKey === stepKey}
                onComplete={() => handleAction(stepKey, "complete")}
                onSkip={() => handleAction(stepKey, "skip")}
              />
            );
          })}
        </ol>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      ) : null}
    </section>
  );
}

function StepRow({
  step,
  busy,
  onComplete,
  onSkip,
}: {
  step: StepRecord;
  busy: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const meta = STEP_META[step.stepKey];
  const isDone =
    step.status === OnboardingStepStatus.COMPLETED ||
    step.status === OnboardingStepStatus.SKIPPED;
  const isSkipped = step.status === OnboardingStepStatus.SKIPPED;

  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5">
      <span
        aria-hidden="true"
        className={`shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full mt-0.5 ${
          isDone
            ? isSkipped
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground"
            : "bg-card border border-border text-muted-foreground"
        }`}
      >
        {isDone ? (
          isSkipped ? (
            <XIcon className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )
        ) : (
          <Circle className="h-2.5 w-2.5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-semibold leading-snug ${
            isDone ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {meta.label}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
          {meta.description}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        {!isDone ? (
          <>
            <Link
              href={meta.href}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              Go
              <ArrowRight className="h-3 w-3" />
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={onComplete}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-2 py-1 text-[11px] font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              Done
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSkip}
              className="inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {isSkipped ? "Skipped" : "Done"}
          </span>
        )}
      </div>
    </li>
  );
}
