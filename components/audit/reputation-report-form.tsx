"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// ReputationReportForm — lead-capture form for the /reputation-report
// landing page. Copied from AiVisibilityForm (same form family: property
// name, website, email; same /api/audit/start + poll flow) with the report
// redirect pointed at the #reputation anchor instead of #ai-search, and
// scan-status copy reordered to lead with review/mention scanning since
// that's the promise on this page. Kept as its own file rather than a
// shared component — the two forms differ only in copy + redirect target,
// and this is a marketing surface, not shared product logic.
//
// Flow:
//   1. POST /api/audit/start { url, brandName, email }
//   2. If the response is a cached audit (dedupe window), fire
//      capture-email for that row too — best-effort, 409 = already have it.
//   3. Poll /api/audit/[id] until READY, then redirect to
//      /audit/[token]#reputation (report opens at the reputation section).
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 130_000;

const SCAN_STATUS_MESSAGES: string[] = [
  "Scanning Google, Yelp, and Reddit for mentions of your property…",
  "Reading reviews for anything renters flagged as a problem…",
  "Checking which mentions have a reply and which are unanswered…",
  "Asking ChatGPT and Perplexity what they say about your reputation…",
  "Identifying competitors renters compare you to…",
  "Auditing your homepage for AI-citability (schema, FAQs, canonicals)…",
  "Scoring your reputation across every source…",
  "Writing your prioritized action plan…",
  "Finalizing your report…",
];
const SCAN_STATUS_INTERVAL_MS = 2600;

type Phase = "form" | "starting" | "scanning" | "error";

interface StartResponse {
  auditId: string;
  shareToken: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  cached?: boolean;
}

export function ReputationReportForm() {
  const router = useRouter();
  const [propertyName, setPropertyName] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(
      () =>
        setStatusIdx((i) => Math.min(i + 1, SCAN_STATUS_MESSAGES.length - 1)),
      SCAN_STATUS_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, [phase]);

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
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<
        StartResponse & { error: string }
      >;
      if (!res.ok || !data.auditId || !data.shareToken) {
        setPhase("error");
        setError(data.error ?? "Could not start your report. Try again.");
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
        router.push(`/audit/${data.shareToken}#reputation`);
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
          router.push(`/audit/${data.shareToken}#reputation`);
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
    return (
      <div
        className="rounded-[4px] border p-8 text-center"
        style={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" }}
      >
        <Loader2
          className="mx-auto mb-4 h-6 w-6 animate-spin"
          style={{ color: "#2563EB" }}
        />
        <p className="text-[15px] font-semibold" style={{ color: "#1E2A3A" }}>
          Running your reputation report
        </p>
        <p className="mt-2 text-[13px]" style={{ color: "#64748B" }}>
          {phase === "starting"
            ? "Queuing your scan…"
            : SCAN_STATUS_MESSAGES[statusIdx]}
        </p>
        <p className="mt-4 text-[12px]" style={{ color: "#64748B" }}>
          Usually under 2 minutes. Your report link is saved to{" "}
          <span className="font-medium">{email.trim()}</span>.
        </p>
      </div>
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
        Run my free reputation report
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  autoComplete: string;
  inputMode?: "url";
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
        required
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
