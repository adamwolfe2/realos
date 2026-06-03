import * as React from "react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
  GoogleMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// AuditTrustStrip — premium credibility band that lives between the
// hero and the pillar grid on /audit/[token].
//
// Three jobs:
//   1. Logo rail of the four AI engines we just queried. Visual proof
//      this isn't a "fancy quiz" — we ran live LLM calls.
//   2. A factual one-liner with the audit timing + count of API calls
//      so the prospect sees we did the work.
//   3. A subtle "audit id" line so the report feels traceable.
//
// Design rules: light only, no emojis, brand-blue accent. Honors the
// rest of the audit result-page palette (#1E2A3A / #6B7280 / #E5E7EB).
// ---------------------------------------------------------------------------

export type AuditTrustStripProps = {
  brandName: string;
  /** Number of distinct AI engines that returned a response. */
  enginesQueried: number;
  /** Number of reputation sources scanned (Reddit + Yelp + ...). */
  reputationSources: number;
  /** Total mentions found across all reputation sources. */
  totalMentions: number;
  /** Number of AEO prompts run × engines. */
  totalAiResponses: number;
  /** ISO string of when the audit ran. */
  auditedAtIso: string;
  /** Short audit ID for the traceability line. */
  auditId: string;
};

export function AuditTrustStrip({
  brandName,
  enginesQueried,
  reputationSources,
  totalMentions,
  totalAiResponses,
  auditedAtIso,
  auditId,
}: AuditTrustStripProps) {
  const ran = formatRan(auditedAtIso);
  // Compact id surface — first 8 chars is enough for traceability while
  // staying visually quiet.
  const shortId = auditId.slice(0, 8);
  return (
    <section
      className="mt-6 rounded-2xl"
      style={{
        backgroundColor: "#F8FAFC",
        border: "1px solid #E5E7EB",
        padding: "20px 22px",
      }}
      aria-label={`Trust strip — what we ran for ${brandName}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Logo rail */}
        <div className="flex items-center gap-5">
          <span
            className="hidden sm:inline-flex shrink-0 items-center text-[10px] font-mono uppercase tracking-[0.16em]"
            style={{ color: "#2563EB" }}
          >
            We asked
          </span>
          <ul className="flex items-center gap-3.5" aria-label="AI engines queried">
            <li className="flex items-center gap-1.5">
              <ChatGPTMark size={20} />
              <span style={{ fontSize: 12.5, color: "#1E2A3A", fontWeight: 500 }}>
                ChatGPT
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <PerplexityMark size={20} />
              <span style={{ fontSize: 12.5, color: "#1E2A3A", fontWeight: 500 }}>
                Perplexity
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <ClaudeMark size={20} />
              <span style={{ fontSize: 12.5, color: "#1E2A3A", fontWeight: 500 }}>
                Claude
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <GeminiMark size={20} />
              <span style={{ fontSize: 12.5, color: "#1E2A3A", fontWeight: 500 }}>
                Gemini
              </span>
            </li>
            <li
              aria-hidden
              style={{
                width: 1,
                height: 18,
                backgroundColor: "#E5E7EB",
                margin: "0 4px",
              }}
            />
            <li className="flex items-center gap-1.5">
              <GoogleMark size={20} />
              <span style={{ fontSize: 12.5, color: "#1E2A3A", fontWeight: 500 }}>
                Google AI Overview
              </span>
            </li>
          </ul>
        </div>

        {/* Counts */}
        <ul className="grid grid-cols-3 md:flex md:items-center gap-x-5 gap-y-1 shrink-0">
          <TrustStat label="AI responses" value={totalAiResponses} />
          <TrustStat label="Sources scanned" value={reputationSources} />
          <TrustStat label="Mentions found" value={totalMentions} />
        </ul>
      </div>

      <p
        className="mt-3 pt-3 text-[11px]"
        style={{
          borderTop: "1px solid #E5E7EB",
          color: "#6B7280",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
        }}
      >
        {brandName} · {enginesQueried} engines · live API calls · audited {ran} ·
        audit-id <span style={{ color: "#1E2A3A" }}>{shortId}</span> · every
        number below is real and traceable.
      </p>
    </section>
  );
}

function TrustStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <li className="leading-tight">
      <span
        className="block text-[16px] font-semibold tabular-nums"
        style={{ color: "#1E2A3A" }}
      >
        {value}
      </span>
      <span
        className="block text-[10px] font-mono uppercase tracking-[0.10em]"
        style={{ color: "#6B7280" }}
      >
        {label}
      </span>
    </li>
  );
}

function formatRan(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "just now";
  }
}
