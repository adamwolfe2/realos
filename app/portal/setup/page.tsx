import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireScope } from "@/lib/tenancy/scope";
import {
  deriveSetupProgress,
  type ResolvedSetupStep,
} from "@/lib/setup/derive-progress";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/setup/steps";
import { SetupStepCard } from "@/components/portal/setup/setup-step-card";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Setup Hub — the client's home during their first 1–2 weeks.
//
// Hero (greeting + progress bar + phase chips) → vertical timeline of 10
// steps grouped into Foundation / Growth / Polish. A single step is
// "current" at any moment — the first pending one in timeline order. The
// Growth phase is hidden behind a subtle Foundation-complete banner that
// naturally decomposes as Growth steps progress.
// ---------------------------------------------------------------------------

export default async function SetupHubPage() {
  const scope = await requireScope();
  const progress = await deriveSetupProgress(scope.orgId);

  if (!progress) notFound();

  const {
    steps,
    completedCount,
    totalCount,
    foundationComplete,
    phase,
    daysToLaunch,
    org,
  } = progress;

  const percent = Math.round((completedCount / totalCount) * 100);

  const phaseSubtitle = (() => {
    if (phase === "done") {
      return `All ${totalCount} steps complete · your stack is live`;
    }

    const label =
      phase === "foundation"
        ? "Week 1 of your setup"
        : phase === "growth"
        ? "Week 2 of your setup"
        : "Polish";

    const foundationSteps = steps.filter((s) => s.phase === "foundation");
    const foundationDone = foundationSteps.filter(
      (s) => s.status === "done"
    ).length;

    const progressLine =
      phase === "foundation"
        ? `${foundationDone} of ${foundationSteps.length} foundation steps complete`
        : `${completedCount} of ${totalCount} steps complete`;

    const launchLine =
      daysToLaunch === 0 ? "ready to launch" : `~${daysToLaunch} days to launch`;

    return `${label} · ${progressLine} · ${launchLine}`;
  })();

  // Phase chip counts
  const phaseCounts = PHASE_ORDER.map((p) => {
    const inPhase = steps.filter((s) => s.phase === p);
    const done = inPhase.filter((s) => s.status === "done").length;
    return { phase: p, done, total: inPhase.length };
  });

  return (
    <div className="space-y-10">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-[var(--near-black)]">
            Welcome, {org.name}.
          </h1>
          <p className="font-sans text-sm text-[var(--stone-gray)]">
            {phaseSubtitle}
          </p>
        </div>

        <div className="space-y-3">
          <div
            className="h-1.5 w-full rounded-full bg-[var(--warm-sand)] overflow-hidden"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall setup progress"
          >
            <div
              className="h-1.5 rounded-full bg-[var(--terracotta)] transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {phaseCounts.map(({ phase: p, done, total }) => (
              <PhaseChip
                key={p}
                label={
                  p === "foundation"
                    ? "Foundation"
                    : p === "growth"
                    ? "Growth"
                    : "Polish"
                }
                done={done}
                total={total}
                active={phase === p}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Phase sections with timeline ────────────────────────────────── */}
      {PHASE_ORDER.map((p) => {
        const phaseSteps = steps.filter((s) => s.phase === p);
        if (phaseSteps.length === 0) return null;

        return (
          <section key={p} aria-labelledby={`phase-${p}`}>
            <h2
              id={`phase-${p}`}
              className="font-sans text-xs uppercase tracking-[0.12px] text-[var(--stone-gray)] mb-4"
            >
              {PHASE_LABELS[p]}
            </h2>

            {/* Foundation-complete celebration appears between Foundation
                and Growth. It renders inside Growth's section header so the
                border reads as a transition rather than an interruption. */}
            {p === "growth" && foundationComplete ? (
              <FoundationCompleteBanner />
            ) : null}

            <TimelineList steps={phaseSteps} />
          </section>
        );
      })}
    </div>
  );
}

// ── Phase chip (stat pill below progress bar) ─────────────────────────────

function PhaseChip({
  label,
  done,
  total,
  active,
}: {
  label: string;
  done: number;
  total: number;
  active: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-[var(--terracotta)]/30 bg-[var(--terracotta)]/5 text-[var(--terracotta)]"
          : "border-[var(--border-cream)] bg-[var(--ivory)] text-[var(--charcoal-warm)]",
      ].join(" ")}
    >
      <span className="tabular-nums">
        {done}/{total}
      </span>
      <span className="text-[var(--stone-gray)]">·</span>
      <span>{label}</span>
    </span>
  );
}

// ── Foundation complete banner ────────────────────────────────────────────

function FoundationCompleteBanner() {
  return (
    <div className="mb-6 rounded-[12px] border border-[var(--terracotta)]/20 bg-[var(--terracotta)]/5 p-5">
      <h3 className="font-serif text-xl font-medium text-[var(--near-black)]">
        Foundation complete.
      </h3>
      <p className="mt-1 font-sans text-sm text-[var(--olive-gray)] leading-[1.6]">
        Your lead pipeline is live. Let&apos;s connect your ad accounts next.
      </p>
    </div>
  );
}

// ── Timeline list (vertical rail + stacked step cards) ────────────────────

function TimelineList({ steps }: { steps: ResolvedSetupStep[] }) {
  return (
    <div className="relative">
      {/* Vertical rail — hidden on mobile, runs through dot centers. */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute left-[9px] top-5 bottom-5 w-[2px] bg-[var(--border-warm)]"
      />

      <ul className="space-y-3 md:space-y-4">
        {steps.map((step) => (
          <li key={step.id}>
            <SetupStepCard step={step} />
          </li>
        ))}
      </ul>
    </div>
  );
}
