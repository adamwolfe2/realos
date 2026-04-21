"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Check } from "lucide-react";
import { BRAND_EMAIL } from "@/lib/brand";
import type { Step1Data, Step2Data, Step3Data, Step4Data } from "./types";
import {
  STEPS,
  STEP_HEADINGS,
  STEP_SUBTITLES,
  STEP1_DEFAULT,
  STEP2_DEFAULT,
  STEP3_DEFAULT,
  STEP4_DEFAULT,
  loadDraft,
  clearDraft,
  saveDraft,
  buildIntakePayload,
  type IntakeDraft,
} from "./constants";
import { StepCompany, validateStep1 } from "./step-company";
import { StepPortfolio, validateStep2 } from "./step-portfolio";
import { StepServices, validateStep3 } from "./step-services";
import { StepBooking, validateStep4 } from "./step-booking";

// ---------------------------------------------------------------------------
// Per-step validation dispatch
// ---------------------------------------------------------------------------

function isStepValid(
  step: number,
  s1: Step1Data,
  s2: Step2Data,
  s3: Step3Data,
  s4: Step4Data
): boolean {
  if (step === 0) return Object.keys(validateStep1(s1)).length === 0;
  if (step === 1) return Object.keys(validateStep2(s2)).length === 0;
  if (step === 2) return Object.keys(validateStep3(s3)).length === 0;
  if (step === 3) return Object.keys(validateStep4(s4)).length === 0;
  return true;
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Step ${current + 1} of ${total}`}
      className="h-1 bg-muted w-full overflow-hidden"
    >
      <div
        className="h-full bg-foreground transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save-and-resume banner
// ---------------------------------------------------------------------------

function ResumeBanner({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }, [url]);

  return (
    <div className="border-t px-4 sm:px-6 py-4 bg-muted/50 space-y-3">
      <p className="text-xs leading-relaxed">
        Your progress is saved. Copy the link below to pick up where you left
        off from any device. The link expires in 72 hours.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 text-[11px] border rounded px-2 py-1.5 bg-white font-mono truncate"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-semibold rounded"
          style={{ borderRadius: "6px" }}
        >
          {copied ? (
            <Check className="w-3 h-3" aria-hidden="true" />
          ) : (
            <Copy className="w-3 h-3" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-[11px] opacity-60 underline underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard (inner — uses useSearchParams so must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function IntakeWizardInner() {
  const searchParams = useSearchParams();
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
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [generatingResume, setGeneratingResume] = useState(false);

  // Handle ?resume=<token> query param — call API to verify + hydrate
  useEffect(() => {
    const token = searchParams.get("resume");
    if (!token) return;

    fetch(`/api/onboarding/resume?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ok: boolean; draft: IntakeDraft } | null) => {
        if (json?.ok && json.draft) {
          const d = json.draft;
          setStep1(d.step1 ?? STEP1_DEFAULT);
          setStep2(d.step2 ?? STEP2_DEFAULT);
          setStep3(d.step3 ?? STEP3_DEFAULT);
          setStep4(d.step4 ?? STEP4_DEFAULT);
          setCurrentStep(d.step ?? 0);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const valid = isStepValid(currentStep, step1, step2, step3, step4);
    if (!valid) {
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

  const handleSaveAndClose = async () => {
    if (generatingResume) return;
    setGeneratingResume(true);

    const currentDraft: IntakeDraft = {
      step: currentStep,
      step1,
      step2,
      step3,
      step4,
      savedAt: Date.now(),
    };

    try {
      const res = await fetch("/api/onboarding/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentDraft),
      });

      if (res.ok) {
        const { token } = (await res.json()) as { token: string };
        const base = window.location.origin;
        setResumeUrl(`${base}/onboarding?resume=${encodeURIComponent(token)}`);
      } else {
        // Fallback: generate token client-side is not possible (server secret).
        // Show a simpler "saved locally" message.
        setResumeUrl(null);
      }
    } catch {
      setResumeUrl(null);
    } finally {
      setGeneratingResume(false);
    }

    // Always save to localStorage as backup
    saveDraft(currentDraft);
  };

  const valid = isStepValid(currentStep, step1, step2, step3, step4);

  return (
    <div className="border rounded-lg bg-white overflow-hidden flex flex-col">
      {/* Draft resume banner */}
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

      {/* Progress bar */}
      <ProgressBar current={currentStep} total={STEPS.length} />

      {/* Step tabs */}
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

      {/* Step header */}
      <header className="border-b px-4 sm:px-6 py-4">
        <p className="text-[10px] tracking-widest uppercase opacity-50 mb-1">
          Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
        </p>
        <h2 className="text-lg sm:text-xl font-serif">
          {STEP_HEADINGS[currentStep]}
        </h2>
        <p className="text-xs opacity-70 mt-1">
          {STEP_SUBTITLES[currentStep]}
        </p>
      </header>

      {/* Step body */}
      <div className="px-3 sm:px-6 py-4 sm:py-6 flex-1">
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
            attempted={attempted}
          />
        )}
        {currentStep === 2 && (
          <StepServices
            data={step3}
            onChange={(d) => setStep3((p) => ({ ...p, ...d }))}
            attempted={attempted}
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
            attempted={attempted}
          />
        )}
      </div>

      {/* Success banner */}
      {submitted && currentStep === 3 ? (
        <div className="border-t px-4 sm:px-6 py-3 flex items-center gap-2 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <p className="text-xs">
            Intake received. Pick a time below, or our team will reach out
            within one business day.
          </p>
        </div>
      ) : null}

      {/* Error banner */}
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

      {/* Resume link banner */}
      {resumeUrl !== undefined && resumeUrl !== null ? (
        <ResumeBanner url={resumeUrl} onClose={() => setResumeUrl(null)} />
      ) : null}

      {/* Navigation footer -- sticky on mobile */}
      {currentStep < 3 ? (
        <div className="sticky bottom-0 border-t px-4 sm:px-6 py-4 bg-white">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-30 min-h-[44px] px-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back
            </button>

            <div className="flex flex-col items-end gap-1">
              {attempted && !valid ? (
                <span className="text-[11px] text-destructive">
                  Fill in the required fields above
                </span>
              ) : null}
              <div className="flex items-center gap-3">
                {/* Save and finish later — only show after step 1 data is present */}
                {step1.primaryContactEmail ? (
                  <button
                    type="button"
                    onClick={handleSaveAndClose}
                    disabled={generatingResume}
                    className="text-[11px] opacity-60 underline underline-offset-2 min-h-[44px]"
                  >
                    {generatingResume ? "Saving..." : "Save and finish later"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-5 py-3 text-xs font-semibold tracking-wide disabled:opacity-40 min-h-[44px]"
                  style={{ borderRadius: "6px" }}
                >
                  {submitting
                    ? "Submitting..."
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
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — wraps the inner component in Suspense so that
// useSearchParams() does not force the whole page to opt out of SSR.
// ---------------------------------------------------------------------------

export function IntakeWizard() {
  return (
    <Suspense>
      <IntakeWizardInner />
    </Suspense>
  );
}
