"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  done: boolean;
};

export type SetupWizardProps = {
  steps: WizardStep[];
  onDismiss: () => void;
};

export function SetupWizard({ steps, onDismiss }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<number>(() => {
    const firstIncomplete = steps.findIndex((s) => !s.done);
    return firstIncomplete === -1 ? steps.length - 1 : firstIncomplete;
  });

  const step = steps[currentStep];
  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const allDone = completedCount === totalSteps;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  function advance() {
    const next = steps.findIndex((s, i) => i > currentStep && !s.done);
    if (next !== -1) {
      setCurrentStep(next);
    } else {
      const anyIncomplete = steps.findIndex((s) => !s.done);
      if (anyIncomplete !== -1) {
        setCurrentStep(anyIncomplete);
      } else {
        onDismiss();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Setup wizard"
    >
      <div className="max-w-lg w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-foreground">
              Get started with LeaseStack
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedCount} of {totalSteps} complete
            </span>
          </div>
          {/* Progress bar — fills based on actual completion, not wizard position */}
          <div
            className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalSteps}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {/* Step dots */}
          <div className="mt-3 flex items-center gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(i)}
                aria-label={`${s.title}${s.done ? " (complete)" : ""}`}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  s.done
                    ? "bg-primary"
                    : i === currentStep
                    ? "bg-primary/50 w-4"
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        </div>

        {allDone ? (
          /* All-done celebration state */
          <div className="px-6 py-8 border-t border-border text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-lg font-semibold">You're all set</span>
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              All setup steps complete. Your LeaseStack workspace is ready.
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Go to dashboard
            </button>
          </div>
        ) : (
          /* Current step */
          <div className="px-6 py-5 border-t border-border">
            <div className="flex items-start gap-4">
              <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full border-2 border-primary text-primary text-sm font-semibold">
                {currentStep + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              {step.actionHref ? (
                <Link
                  href={step.actionHref}
                  onClick={advance}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {step.actionLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={advance}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {step.actionLabel}
                </button>
              )}
              {!allDone && (
                <button
                  type="button"
                  onClick={advance}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completed steps tray */}
        {completedCount > 0 && !allDone && (
          <div className="px-6 py-3 border-t border-border bg-muted/30">
            <ul className="flex flex-wrap gap-3">
              {steps.map((s) =>
                s.done ? (
                  <li
                    key={s.id}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <CheckCircle2
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden="true"
                    />
                    <span>{s.title}</span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        )}

        {/* Footer */}
        {!allDone && (
          <div className="px-6 py-4 border-t border-border flex justify-center">
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              I&apos;ll do this later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
