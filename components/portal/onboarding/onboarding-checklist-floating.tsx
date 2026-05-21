"use client";

// ---------------------------------------------------------------------------
// OnboardingChecklistFloating — bottom-right docked variant.
//
// Norman feedback (2026-05-21 dashboard screenshot): the previous
// full-width checklist card consumed the entire top band of /portal,
// shoving the metrics — the actual product surface — below the fold.
// This variant keeps every step + every action (Go / Done / Skip) but
// pins to the bottom-right of the viewport as a collapsed pill that
// expands into a slim card on click.
//
// Behavior:
//   - Collapsed: 200px pill — "Setup · 2/5" with a progress ring + chev.
//   - Expanded: 380px card — full step list, scrolls if it overflows.
//   - Dismiss-to-pill, not dismiss-forever — the card stays mounted
//     until POLISH completes and the parent stops rendering it.
//   - Persists collapsed/expanded state in localStorage so it does not
//     flap on every navigation.
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
  Sparkles,
} from "lucide-react";

type Props = {
  progress: ProgressSnapshot;
};

const PHASE_LABELS: Record<Exclude<OnboardingPhase, "COMPLETED">, string> = {
  FOUNDATION: "Get the platform working",
  GROWTH: "Capture your first lead",
  POLISH: "Polish and expand",
};

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
    href: "/portal/settings/integrations",
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
    label: "Publish a neighborhood SEO page",
    description: 'Rank for "apartments near <neighborhood>" searches.',
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

const STORAGE_KEY = "ls.onboarding.floating.expanded";

export function OnboardingChecklistFloating({ progress }: Props) {
  const phase = progress.currentPhase;
  const isCompleted = phase === OnboardingPhase.COMPLETED;

  // Default collapsed to maximise dashboard real estate. Persist preference.
  const [expanded, setExpanded] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [busyStepKey, setBusyStepKey] =
    React.useState<OnboardingStepKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setExpanded(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded, hydrated]);

  if (isCompleted) return null;

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
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyStepKey(null);
    }
  }

  // Progress-ring SVG geometry. 18px radius, 4px stroke → 22px viewBox.
  const ringR = 9;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDash = (phaseProg.pct / 100) * ringCirc;

  return (
    <div
      aria-label="Onboarding checklist"
      className="fixed bottom-4 right-4 z-40 print:hidden"
    >
      {expanded ? (
        <section
          className="w-[380px] max-w-[calc(100vw-2rem)] max-h-[min(70vh,640px)] flex flex-col rounded-xl border border-border bg-card shadow-xl ring-1 ring-black/[0.04] overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-150"
        >
          <header className="flex items-start gap-2.5 px-4 pt-3.5 pb-3 border-b border-border bg-gradient-to-br from-card to-primary/[0.04]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]">
                  {phase}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {phaseProg.completed} / {phaseProg.total}
                </span>
              </div>
              <h2 className="text-[13px] font-semibold tracking-tight text-foreground leading-tight">
                Setup · {PHASE_LABELS[phase as Exclude<OnboardingPhase, "COMPLETED">]}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Collapse setup checklist"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </header>

          <div
            aria-hidden="true"
            className="h-1 bg-muted overflow-hidden shrink-0"
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${phaseProg.pct}%` }}
            />
          </div>

          <ol className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
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

          {error ? (
            <p className="px-4 pb-3 text-[11px] text-destructive">{error}</p>
          ) : null}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-card pl-2 pr-3.5 py-1.5 shadow-lg ring-1 ring-black/[0.04] hover:shadow-xl hover:border-primary/30 transition-all animate-in fade-in duration-150"
          aria-label={`Open setup checklist — ${phaseProg.completed} of ${phaseProg.total} done`}
        >
          <span className="relative inline-flex h-6 w-6 items-center justify-center shrink-0">
            <svg className="absolute inset-0" viewBox="0 0 22 22" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r={ringR}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted"
              />
              <circle
                cx="11"
                cy="11"
                r={ringR}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${ringDash} ${ringCirc}`}
                transform="rotate(-90 11 11)"
                className="text-primary transition-all"
              />
            </svg>
            <Sparkles className="h-3 w-3 text-primary relative" />
          </span>
          <span className="text-[12px] font-semibold text-foreground tracking-tight tabular-nums">
            Setup · {phaseProg.completed}/{phaseProg.total}
          </span>
          <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      )}
    </div>
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
    <li className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-2">
      <span
        aria-hidden="true"
        className={`shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full mt-0.5 ${
          isDone
            ? isSkipped
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground"
            : "bg-card border border-border text-muted-foreground"
        }`}
      >
        {isDone ? (
          isSkipped ? (
            <XIcon className="h-2.5 w-2.5" />
          ) : (
            <Check className="h-2.5 w-2.5" />
          )
        ) : (
          <Circle className="h-2 w-2" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[11.5px] font-semibold leading-snug ${
            isDone ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {meta.label}
        </p>
        {!isDone ? (
          <p className="text-[10.5px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            {meta.description}
          </p>
        ) : null}
        {!isDone ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Link
              href={meta.href}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              Go
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={onComplete}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              Done
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSkip}
              className="inline-flex items-center text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
