"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanProgress } from "@/components/ui/scan-progress";
import {
  QUIZ_QUESTIONS,
  isQuizComplete,
  type Choice,
  type Question,
  type QuizAnswers,
} from "@/lib/audit/quiz-questions";

// ---------------------------------------------------------------------------
// DigitalScoreQuiz. Multi-step quiz that powers the /audit lead magnet.
//
// Replaces the single-field AuditForm. Flow:
//   1. Step through QUIZ_QUESTIONS (single, multi, url).
//   2. On final step submit, POST { url, quizAnswers } to /api/audit/start.
//   3. Poll /api/audit/[id] until READY, then redirect to /audit/[token].
//
// Poll + scan-status rendering is intentionally identical to the original
// AuditForm so we don't fork the loading experience. If the start route
// rejects the quizAnswers field (older deploy / cached client), the route
// still accepts the bare `{ url }` body and the scan runs without quiz
// context. Quiz answers are additive, never blocking.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 130_000;

// Identical to AuditForm's SCAN_STATUS_MESSAGES list. Kept inline rather
// than imported because the existing AuditForm exports nothing and we
// don't want to widen its surface just for sharing. If/when the list
// grows we'll lift to lib/audit/scan-status.ts.
const SCAN_STATUS_MESSAGES: string[] = [
  "Pulling ranked keywords for your market…",
  "Running a mobile Lighthouse audit on your homepage…",
  "Extracting page metadata and on-page checks…",
  "Counting backlinks and referring domains…",
  "Estimating organic search traffic from rank × CTR…",
  "Inspecting title tags, descriptions, and canonicals…",
  "Querying Claude about your property…",
  "Querying ChatGPT about your property…",
  "Querying Gemini about your property…",
  "Querying Perplexity about your property…",
  "Checking which AI engines cite your brand by name…",
  "Identifying competitors cited instead of you…",
  "Categorizing AI search queries by intent…",
  "Tracking Perplexity queries about your market…",
  "Scanning Reddit for brand mentions…",
  "Sorting through Reddit comment threads…",
  "Searching Yelp for property reviews…",
  "Checking Google for review listings…",
  "Pulling ApartmentRatings.com mentions…",
  "Scanning BBB for complaint filings…",
  "Searching Facebook for review posts…",
  "Sorting through Facebook groups…",
  "Crawling open-web review sites…",
  "Ranking sites with brand mentions…",
  "Classifying mention sentiment with Claude Haiku…",
  "Computing your Digital Performance Score…",
  "Generating prioritized action items…",
  "Tracking competitors near your property…",
  "Writing your narrative summary…",
  "Finalizing your report…",
];
const SCAN_STATUS_INTERVAL_MS = 2400;

type Phase = "quiz" | "starting" | "scanning" | "error";

interface StartResponse {
  auditId: string;
  shareToken: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  cached?: boolean;
}
interface StatusResponse {
  id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
}

export function DigitalScoreQuiz() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [phase, setPhase] = useState<Phase>("quiz");
  const [error, setError] = useState<string | null>(null);
  const [scannedDomain, setScannedDomain] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const question = QUIZ_QUESTIONS[stepIndex];
  const totalSteps = QUIZ_QUESTIONS.length;
  const isLastStep = stepIndex === totalSteps - 1;
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;
  const currentAnswer = answers[question.id];
  const canAdvance = stepHasValidAnswer(question, currentAnswer);

  const setAnswer = useCallback(
    (questionId: string, value: string | string[]) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    [],
  );

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    if (!canAdvance) return;
    setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
  }, [canAdvance, totalSteps]);

  const redirect = useCallback(
    (token: string) => router.push(`/audit/${token}`),
    [router],
  );

  const startPolling = useCallback(
    (auditId: string, token: string, domain: string) => {
      setPhase("scanning");
      setScannedDomain(domain);
      const startedAt = Date.now();
      const poll = async () => {
        if (stoppedRef.current) return;
        try {
          const res = await fetch(`/api/audit/${auditId}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Status check failed");
          const data: StatusResponse = await res.json();
          if (data.status === "READY") {
            if (pollRef.current) clearInterval(pollRef.current);
            redirect(token);
            return;
          }
          if (data.status === "FAILED") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("The scan failed. Try again in a moment.");
            setPhase("error");
            return;
          }
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("Still working. Open the report from this link.");
            setPhase("error");
          }
        } catch {
          // Transient. Keep polling until timeout.
        }
      };
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
      void poll();
    },
    [redirect],
  );

  const submitFinal = useCallback(async () => {
    if (!isQuizComplete(answers)) {
      setError("Finish each step before submitting.");
      return;
    }
    const url = String(answers["domain"] ?? "").trim();
    if (!url) {
      setError("Please enter your property website URL.");
      return;
    }
    setError(null);
    setPhase("starting");
    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, quizAnswers: answers }),
      });
      const data: StartResponse | { error: string } = await res.json();
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : "Could not start audit";
        setError(msg);
        setPhase("error");
        return;
      }
      if (data.status === "READY") {
        redirect(data.shareToken);
        return;
      }
      startPolling(data.auditId, data.shareToken, normalizeUrlForDisplay(url));
    } catch {
      setError("Network error. Try again.");
      setPhase("error");
    }
  }, [answers, redirect, startPolling]);

  if (phase === "scanning" || phase === "starting") {
    return (
      <ScanProgress
        messages={SCAN_STATUS_MESSAGES}
        intervalMs={SCAN_STATUS_INTERVAL_MS}
        footer={`Scanning ${scannedDomain ?? "your site"} · usually 30-60 seconds`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ProgressHeader
        current={stepIndex + 1}
        total={totalSteps}
        pct={progressPct}
      />

      <div
        className="rounded-xl border bg-white p-5 sm:p-7 text-left flex flex-col gap-5"
        style={{ borderColor: "#E5E7EB" }}
      >
        <QuestionHeader question={question} />
        <QuestionBody
          question={question}
          value={currentAnswer}
          onChange={(value) => setAnswer(question.id, value)}
          onSubmitFinal={isLastStep ? submitFinal : undefined}
        />
        <NavRow
          stepIndex={stepIndex}
          isLastStep={isLastStep}
          canAdvance={canAdvance}
          onBack={goBack}
          onNext={goNext}
          onSubmit={submitFinal}
        />
      </div>

      {error ? (
        <p className="text-sm px-1" style={{ color: "#B91C1C" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ProgressHeader({
  current,
  total,
  pct,
}: {
  current: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em] whitespace-nowrap"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Step {current} of {total}
      </p>
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: "#2563EB",
            transition: "width 240ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

function QuestionHeader({ question }: { question: Question }) {
  return (
    <div>
      <h2
        className="text-lg sm:text-2xl font-semibold leading-snug"
        style={{ color: "#1E2A3A" }}
      >
        {question.prompt}
      </h2>
      {question.helper ? (
        <p
          className="text-[13px] sm:text-sm mt-2 leading-relaxed"
          style={{ color: "#6B7280" }}
        >
          {question.helper}
        </p>
      ) : null}
    </div>
  );
}

function QuestionBody({
  question,
  value,
  onChange,
  onSubmitFinal,
}: {
  question: Question;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  /** When set, hitting Enter on a URL input triggers the final submit. */
  onSubmitFinal?: () => void;
}) {
  if (question.kind === "single") {
    return (
      <ul className="flex flex-col gap-2">
        {(question.choices ?? []).map((choice) => (
          <SingleChoiceRow
            key={choice.id}
            choice={choice}
            selected={value === choice.id}
            onSelect={() => onChange(choice.id)}
          />
        ))}
      </ul>
    );
  }

  if (question.kind === "multi") {
    const selected = new Set(Array.isArray(value) ? value : []);
    const toggle = (choiceId: string) => {
      const next = new Set(selected);
      // "None" choices are mutually exclusive with everything else. Selecting
      // "None" clears the others, and selecting anything else clears "None".
      const isNone = choiceId.startsWith("none");
      if (isNone) {
        onChange(selected.has(choiceId) ? [] : [choiceId]);
        return;
      }
      // Strip any previously-set "none" choice.
      for (const id of Array.from(next)) {
        if (id.startsWith("none")) next.delete(id);
      }
      if (next.has(choiceId)) next.delete(choiceId);
      else next.add(choiceId);
      onChange(Array.from(next));
    };
    return (
      <ul className="flex flex-col gap-2">
        {(question.choices ?? []).map((choice) => (
          <MultiChoiceRow
            key={choice.id}
            choice={choice}
            selected={selected.has(choice.id)}
            onToggle={() => toggle(choice.id)}
          />
        ))}
      </ul>
    );
  }

  // url
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmitFinal?.();
      }}
    >
      <Input
        type="text"
        inputMode="url"
        autoComplete="off"
        placeholder={question.placeholder ?? "yourproperty.com"}
        aria-label={question.prompt}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-base"
      />
    </form>
  );
}

function SingleChoiceRow({
  choice,
  selected,
  onSelect,
}: {
  choice: Choice;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full text-left rounded-lg border px-4 py-3.5 sm:py-3 transition-colors active:scale-[0.99]"
        style={{
          borderColor: selected ? "#2563EB" : "#E5E7EB",
          backgroundColor: selected ? "rgba(37,99,235,0.06)" : "#FFFFFF",
        }}
      >
        <div className="flex items-center gap-3">
          <RadioGlyph selected={selected} />
          <div className="flex-1">
            <p
              className="text-sm font-medium"
              style={{ color: "#1E2A3A" }}
            >
              {choice.label}
            </p>
            {choice.hint ? (
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                {choice.hint}
              </p>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

function MultiChoiceRow({
  choice,
  selected,
  onToggle,
}: {
  choice: Choice;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className="w-full text-left rounded-lg border px-4 py-3.5 sm:py-3 transition-colors active:scale-[0.99]"
        style={{
          borderColor: selected ? "#2563EB" : "#E5E7EB",
          backgroundColor: selected ? "rgba(37,99,235,0.06)" : "#FFFFFF",
        }}
      >
        <div className="flex items-center gap-3">
          <CheckboxGlyph selected={selected} />
          <div className="flex-1">
            <p
              className="text-sm font-medium"
              style={{ color: "#1E2A3A" }}
            >
              {choice.label}
            </p>
            {choice.hint ? (
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                {choice.hint}
              </p>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

function RadioGlyph({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: 18,
        height: 18,
        border: `1.5px solid ${selected ? "#2563EB" : "#CBD5E1"}`,
        backgroundColor: "#FFFFFF",
        flexShrink: 0,
      }}
    >
      {selected ? (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: "#2563EB",
          }}
        />
      ) : null}
    </span>
  );
}

function CheckboxGlyph({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `1.5px solid ${selected ? "#2563EB" : "#CBD5E1"}`,
        backgroundColor: selected ? "#2563EB" : "#FFFFFF",
        color: "#FFFFFF",
        flexShrink: 0,
      }}
    >
      {selected ? (
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8l3.5 3.5L13 5" />
        </svg>
      ) : null}
    </span>
  );
}

function NavRow({
  stepIndex,
  isLastStep,
  canAdvance,
  onBack,
  onNext,
  onSubmit,
}: {
  stepIndex: number;
  isLastStep: boolean;
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  // Mobile-first nav: Next is the primary action, takes most of the
  // row. Back is a small chip on the left. On sm+ they sit at the row
  // ends with comfortable spacing.
  return (
    <div className="flex items-center gap-3 mt-2">
      <button
        type="button"
        onClick={onBack}
        disabled={stepIndex === 0}
        className="text-sm font-medium px-3 py-2 rounded-md transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        style={{ color: "#4B5563" }}
      >
        ← Back
      </button>
      <div className="flex-1 sm:flex-initial sm:ml-auto">
        {isLastStep ? (
          <Button
            type="button"
            size="lg"
            onClick={onSubmit}
            disabled={!canAdvance}
            className="w-full sm:w-auto"
          >
            <span className="sm:hidden">Get my score</span>
            <span className="hidden sm:inline">
              Get my Digital Performance Score
            </span>
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onNext}
            disabled={!canAdvance}
            className="w-full sm:w-auto"
          >
            Next →
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function stepHasValidAnswer(
  question: Question,
  value: string | string[] | undefined,
): boolean {
  if (!question.required) {
    // Optional steps can always advance, touched or not — that's what
    // "optional" means. Requiring the visitor to interact first (e.g. via
    // `value !== undefined`) just adds friction with no signal gained: an
    // untouched optional multi-select is equivalent to "none selected".
    return true;
  }
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function normalizeUrlForDisplay(input: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const u = new URL(withScheme);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}
