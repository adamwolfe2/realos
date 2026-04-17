"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { BRAND_EMAIL } from "@/lib/brand";
import type { Step1Data, Step2Data, Step3Data, Step4Data } from "./types";
import {
  STEPS,
  STEP_HEADINGS,
  STEP_SUBTITLES,
  DRAFT_KEY,
  STEP1_DEFAULT,
  STEP2_DEFAULT,
  STEP3_DEFAULT,
  STEP4_DEFAULT,
  loadDraft,
  clearDraft,
  saveDraft,
  buildIntakePayload,
} from "./constants";
import { StepCompany } from "./step-company";
import { StepPortfolio } from "./step-portfolio";
import { StepServices } from "./step-services";
import { StepBooking } from "./step-booking";

// ---------------------------------------------------------------------------
// Real-estate intake wizard. Forked from Wholesail's wizard shell:
// - Step machine, draft persistence, submit-on-step-3 pattern are preserved.
// - Steps themselves are rewritten for real estate (see step-*.tsx).
// ---------------------------------------------------------------------------

export function IntakeWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [step1, setStep1] = useState<Step1Data>(STEP1_DEFAULT);
  const [step2, setStep2] = useState<Step2Data>(STEP2_DEFAULT);
  const [step3, setStep3] = useState<Step3Data>(STEP3_DEFAULT);
  const [step4, setStep4] = useState<Step4Data>(STEP4_DEFAULT);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft>>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  useEffect(() => {
    const saved = loadDraft();
    if (saved && saved.step1?.companyName) setDraft(saved);
    setDraftChecked(true);
  }, []);

  useEffect(() => {
    if (!draftChecked || submitted || currentStep === 3) return;
    if (!step1.companyName && !step1.primaryContactEmail) return;
    saveDraft({
      step: currentStep,
      step1,
      step2,
      step3,
      step4,
      savedAt: Date.now(),
    });
  }, [currentStep, step1, step2, step3, step4, submitted, draftChecked]);

  const canProceed = () => {
    if (currentStep === 0) {
      return (
        step1.companyName.trim().length > 0 &&
        step1.primaryContactName.trim().length > 0 &&
        step1.primaryContactEmail.trim().length > 0 &&
        step1.propertyType !== ""
      );
    }
    if (currentStep === 1) {
      return step2.biggestPainPoint.trim().length > 0;
    }
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildIntakePayload(step1, step2, step3, step4)),
      });
      if (!res.ok) {
        throw new Error(
          `We couldn't submit your intake. Email ${BRAND_EMAIL} if this keeps happening.`
        );
      }
      setSubmitted(true);
      clearDraft();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Unknown error submitting intake."
      );
      setSubmitting(false);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    setSubmitError(null);
    if (currentStep === 2 && !submitted) {
      try {
        await submit();
      } catch {
        return;
      }
    }
    setCurrentStep((p) => p + 1);
  };

  const handleResumeDraft = () => {
    if (!draft) return;
    setStep1(draft.step1);
    setStep2(draft.step2);
    setStep3(draft.step3);
    setStep4(draft.step4 ?? STEP4_DEFAULT);
    setCurrentStep(draft.step);
    setDraft(null);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraft(null);
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {draft ? (
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap bg-muted border-b">
          <p className="text-xs">
            Welcome back
            {draft.step1.companyName ? `, ${draft.step1.companyName}` : ""}.
            Pick up where you left off?
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResumeDraft}
              className="text-xs font-semibold underline underline-offset-2"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-xs opacity-70"
            >
              Start over
            </button>
          </div>
        </div>
      ) : null}

      <nav aria-label="Intake progress" className="flex border-b">
        {STEPS.map((step, i) => {
          const active = i === currentStep;
          const done = i < currentStep;
          return (
            <div
              key={step}
              aria-current={active ? "step" : undefined}
              className={`flex-1 px-3 py-3 text-center border-r last:border-r-0 ${
                active ? "bg-foreground text-background" : done ? "bg-muted" : ""
              }`}
            >
              <div className="text-[10px] tracking-widest uppercase opacity-70">
                {`0${i + 1}`}
              </div>
              <div className="text-[11px] mt-0.5 hidden sm:block">{step}</div>
            </div>
          );
        })}
      </nav>

      <header className="border-b px-4 sm:px-6 py-4">
        <h2 className="text-lg sm:text-xl font-serif">
          {STEP_HEADINGS[currentStep]}
        </h2>
        <p className="text-xs opacity-70 mt-1">
          {STEP_SUBTITLES[currentStep]}
        </p>
      </header>

      <div className="px-3 sm:px-6 py-4 sm:py-6">
        {currentStep === 0 && (
          <StepCompany
            data={step1}
            onChange={(d) => setStep1((p) => ({ ...p, ...d }))}
            attempted={attempted}
          />
        )}
        {currentStep === 1 && (
          <StepPortfolio
            data={step2}
            onChange={(d) => setStep2((p) => ({ ...p, ...d }))}
          />
        )}
        {currentStep === 2 && (
          <StepServices
            data={step3}
            onChange={(d) => setStep3((p) => ({ ...p, ...d }))}
          />
        )}
        {currentStep === 3 && (
          <StepBooking
            step1={step1}
            step2={step2}
            step3={step3}
            step4={step4}
            onChange={(d) => setStep4((p) => ({ ...p, ...d }))}
            submitted={submitted}
          />
        )}
      </div>

      {submitted && currentStep === 3 ? (
        <div className="border-t px-4 sm:px-6 py-3 flex items-center gap-2 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <p className="text-xs">
            Intake received. Pick a time below, or our team will reach out
            within one business day.
          </p>
        </div>
      ) : null}

      {submitError ? (
        <div className="border-t px-4 sm:px-6 py-3 flex items-start justify-between gap-3 bg-destructive/10 text-destructive">
          <p className="text-xs leading-relaxed">{submitError}</p>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-xs opacity-70"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {currentStep < 3 ? (
        <div className="border-t px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back
            </button>
            <div className="flex flex-col items-end gap-1">
              {attempted && !canProceed() ? (
                <span className="text-[11px] text-destructive">
                  Fill in the required fields above
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleNext}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-5 py-3 text-xs font-semibold tracking-wide disabled:opacity-40"
              >
                {submitting
                  ? "Submitting…"
                  : currentStep === 2
                  ? "Book my call"
                  : "Continue"}
                {submitting ? null : (
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
