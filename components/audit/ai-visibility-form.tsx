"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ScanProgress } from "@/components/ui/scan-progress";

// ---------------------------------------------------------------------------
// AiVisibilityForm — lead-capture form for the /ai-visibility landing page.
//
// One step, three fields: property name, website, email. Email is captured
// BEFORE the scan runs (passed to /api/audit/start), so every submission is
// a contactable lead even if the prospect bounces during the scan wait.
//
// Flow:
//   1. POST /api/audit/start { url, brandName, email }
//   2. If the response is a cached audit (dedupe window), fire
//      capture-email for that row too — best-effort, 409 = already have it.
//   3. Poll /api/audit/[id] until READY, then redirect to
//      /audit/[token]#ai-search (report opens at the per-engine verdict).
//
// Poll cadence mirrors DigitalScoreQuiz so the loading experience matches
// the /audit lead magnet.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 130_000;

const SCAN_STATUS_MESSAGES: string[] = [
  "Asking ChatGPT about your property…",
  "Asking Perplexity about your property…",
  "Asking Claude about your property…",
  "Asking Gemini about your property…",
  "Checking which engines cite your brand by name…",
  "Identifying competitors the AI recommends instead…",
  "Pulling the Google AI Overview for your brand query…",
  "Auditing your homepage for AI-citability (schema, FAQs, canonicals)…",
  "Scanning review sites and Reddit for brand mentions…",
  "Scoring your AI search visibility…",
  "Writing your prioritized action plan…",
  "Finalizing your report…",
];
const SCAN_STATUS_INTERVAL_MS = 2600;
const QUEUING_MESSAGE = ["Queuing your scan…"];

type Phase = "form" | "starting" | "scanning" | "error";

interface StartResponse {
  auditId: string;
  shareToken: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  cached?: boolean;
}

export function AiVisibilityForm() {
  const router = useRouter();
  const [propertyName, setPropertyName] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  // Optional rival (slice 13): tracked explicitly in discovery parsing;
  // the report renders you-vs-them per engine.
  const [competitorName, setCompetitorName] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  const canSubmit =
    propertyName.trim().length >= 2 &&
    url.trim().length >= 4 &&
    /.+@.+\..+/.test(email.trim());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || phase === "starting" || phase === "scanning") return;
    setPhase("starting");
    setError(null);
    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          brandName: propertyName.trim(),
          email: email.trim().toLowerCase(),
          ...(competitorName.trim().length >= 3
            ? { competitorName: competitorName.trim() }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<
        StartResponse & { error: string }
      >;
      if (!res.ok || !data.auditId || !data.shareToken) {
        setPhase("error");
        setError(data.error ?? "Could not start your audit. Try again.");
        return;
      }

      // Dedupe hit: the row already existed, so start didn't write our
      // email. Attach it via capture-email — 409 means it's already there.
      if (data.cached) {
        void fetch(`/api/audit/${data.auditId}/capture-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }).catch(() => {});
      }

      if (data.status === "READY") {
        router.push(`/audit/${data.shareToken}#ai-search`);
        return;
      }

      setPhase("scanning");
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline && !stoppedRef.current) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const poll = await fetch(`/api/audit/${data.auditId}`).catch(
          () => null,
        );
        if (!poll?.ok) continue;
        const status = (await poll.json().catch(() => ({}))) as {
          status?: string;
        };
        if (status.status === "READY") {
          router.push(`/audit/${data.shareToken}#ai-search`);
          return;
        }
        if (status.status === "FAILED") {
          setPhase("error");
          setError(
            "The scan hit an error. We saved your info — try again in a few minutes.",
          );
          return;
        }
      }
      if (!stoppedRef.current) {
        setPhase("error");
        setError(
          "This is taking longer than usual. Your report link will still work — check back shortly.",
        );
      }
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  if (phase === "scanning" || phase === "starting") {
    // Same scan theater as the /audit quiz (shared ScanProgress) instead
    // of the old bare spinner — same underlying scan, same wait quality.
    return (
      <ScanProgress
        messages={phase === "starting" ? QUEUING_MESSAGE : SCAN_STATUS_MESSAGES}
        intervalMs={SCAN_STATUS_INTERVAL_MS}
        advance="hold"
        heading="Running your AI visibility audit"
        footer={
          <>
            Usually under 2 minutes. Your report link is saved to{" "}
            <span className="font-medium">{email.trim()}</span>.
          </>
        }
      />
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[6px] border p-6 md:p-8"
      style={{
        borderColor: "#e0e0e0",
        backgroundColor: "#FFFFFF",
        boxShadow:
          "0 2px 4px rgba(15,23,42,.05), 0 16px 40px rgba(15,23,42,.09)",
      }}
    >
      <div className="grid grid-cols-1 gap-4">
        <Field
          label="Property or community name"
          value={propertyName}
          onChange={setPropertyName}
          placeholder="e.g. Telegraph Commons"
          type="text"
          autoComplete="organization"
        />
        <Field
          label="Property website"
          value={url}
          onChange={setUrl}
          placeholder="e.g. telegraphcommons.com"
          type="text"
          autoComplete="url"
          inputMode="url"
        />
        <Field
          label="Work email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          type="email"
          autoComplete="email"
        />
        <Field
          label="A competitor building (optional)"
          value={competitorName}
          onChange={setCompetitorName}
          placeholder="e.g. The Standard at Berkeley"
          type="text"
          autoComplete="off"
          required={false}
        />
      </div>

      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "#DC2626" }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[2px] px-5 py-3 text-[14px] font-semibold transition-all duration-200 hover:brightness-110 disabled:opacity-50"
        style={{
          backgroundColor: "#0f62fe",
          color: "#FFFFFF",
          boxShadow: "0 4px 14px rgba(15,98,254,.3)",
        }}
      >
        Run my free AI visibility audit
        <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-3 text-center text-[12px]" style={{ color: "#64748B" }}>
        Free · no account needed · results in about 2 minutes
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  autoComplete,
  inputMode,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  autoComplete: string;
  inputMode?: "url";
  required?: boolean;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "#475569" }}
      >
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={200}
        className="h-11 w-full rounded-[2px] border px-3 text-[14px] outline-none transition-colors focus:border-[#2563EB]"
        style={{
          borderColor: "#CBD5E1",
          color: "#1E2A3A",
          backgroundColor: "#FFFFFF",
        }}
      />
    </label>
  );
}
