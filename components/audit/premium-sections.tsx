import * as React from "react";
import { Check, X, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import { GoogleMark } from "@/components/platform/artifacts/brand-logos";
import type {
  AeoOnPageFindings,
  DetectedStack,
  GoogleAiOverviewFindings,
  SchemaGap,
} from "@/lib/audit/synthesize";

// ---------------------------------------------------------------------------
// Premium sections for the /audit result page. Each renders a high-signal,
// data-backed surface meant to feel like an enterprise-grade report:
//   • GoogleAiOverviewCard — verbatim Google AI summary for the brand
//   • AeoOnPageCard         — 8-check on-page AEO scorecard (Page Health)
//   • SchemaGapCard         — schema.org types present vs. missing
//   • DetectedStackCard     — observed conversion stack from the homepage
//
// Brand rules: light only, no emojis, no dark surfaces, ink #161616,
// accent #0f62fe, hairline #e0e0e0, muted #6f6f6f.
// ---------------------------------------------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-mono uppercase tracking-[0.16em]"
      style={{ color: "#0f62fe" }}
    >
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mt-1.5 text-[17px] sm:text-[19px] font-semibold tracking-tight"
      style={{ color: "#161616", letterSpacing: "-0.018em" }}
    >
      {children}
    </h3>
  );
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

// ===========================================================================
// Google AI Overview — verbatim summary returned for the brand-name query
// ===========================================================================

export function GoogleAiOverviewCard({
  findings,
  brandName,
}: {
  findings: GoogleAiOverviewFindings;
  brandName: string;
}) {
  return (
    <section aria-label="Google AI Overview">
      <div
        className="rounded-[2px]"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #e0e0e0",
          padding: "18px 20px",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GoogleMark size={20} />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#161616",
              }}
            >
              Google · AI Overview
            </span>
          </div>
          <CitedChip cited={findings.cited} />
        </div>

        <p
          className="mt-3 text-[10.5px] font-mono uppercase tracking-[0.16em]"
          style={{ color: "#6f6f6f" }}
        >
          Searched &quot;{findings.query}&quot; · what {brandName} looks like to Google
        </p>

        <blockquote
          className="mt-2 text-[14px] leading-relaxed"
          style={{
            color: "#161616",
            borderLeft: "3px solid #0f62fe",
            paddingLeft: 14,
            fontStyle: "italic",
          }}
        >
          &ldquo;{findings.summary}&rdquo;
        </blockquote>

        {findings.citedUrls.length > 0 ? (
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid #e0e0e0" }}>
            <p
              className="text-[10px] font-mono uppercase tracking-[0.14em]"
              style={{ color: "#6f6f6f" }}
            >
              Sources Google cited
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
              {findings.citedUrls.slice(0, 6).map((u) => (
                <li
                  key={u}
                  className="inline-flex items-center gap-1 text-[12px]"
                  style={{ color: "#161616" }}
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: "#161616" }}
                    title={u}
                  >
                    {safeHost(u)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!findings.cited ? (
          <p
            className="mt-4 text-[12.5px]"
            style={{ color: "#161616", fontWeight: 500 }}
          >
            <span style={{ color: "#da1e28", fontWeight: 600 }}>
              You are not cited.
            </span>{" "}
            Google&apos;s AI Overview is answering the question without
            sending searchers to your site.
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ===========================================================================
// AEO Page Health — 8-check on-page AEO scorecard
// ===========================================================================

export function AeoOnPageCard({ findings }: { findings: AeoOnPageFindings }) {
  const passCount = findings.checks.filter((c) => c.pass).length;
  const total = findings.checks.length;
  return (
    <section className="mt-10" aria-label="AEO Page Health">
      <Eyebrow>AEO Page Health · {findings.url}</Eyebrow>
      <H2>Is your homepage citable by AI engines?</H2>
      <p
        className="mt-1.5 text-[12.5px] max-w-2xl"
        style={{ color: "#6f6f6f" }}
      >
        Eight structured-data and content signals AI engines reward when
        deciding which pages to quote. Same scorecard our AEO Boost
        customers run daily.
      </p>

      <div
        className="mt-4 rounded-[2px]"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #e0e0e0",
          padding: "18px 20px",
        }}
      >
        <div className="flex items-center gap-4">
          <ScoreRing score={findings.score} />
          <div className="flex-1 min-w-0">
            <p
              className="text-[13.5px]"
              style={{ color: "#161616", fontWeight: 500 }}
            >
              {passCount} of {total} checks passing
            </p>
            <p
              className="text-[11.5px] mt-0.5 truncate"
              style={{ color: "#6f6f6f" }}
              title={findings.excerpt}
            >
              {findings.excerpt || findings.url}
            </p>
          </div>
        </div>

        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-0">
          {findings.checks.map((c) => (
            <li
              key={c.key}
              className="flex items-start gap-2.5 py-2.5"
              style={{ borderTop: "1px solid #f4f4f4" }}
            >
              <span className="mt-0.5 shrink-0">
                {c.pass ? (
                  <Check className="w-3.5 h-3.5" style={{ color: "#0e6027" }} />
                ) : (
                  <X className="w-3.5 h-3.5" style={{ color: "#a8a8a8" }} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px]"
                  style={{ color: "#161616", fontWeight: 500 }}
                >
                  {c.label}
                </p>
                <p
                  className="text-[11.5px] mt-0.5"
                  style={{ color: "#6f6f6f" }}
                >
                  {c.reason}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const tone =
    score >= 75 ? "#0e6027" : score >= 50 ? "#0f62fe" : "#da1e28";
  // Real arc, not a full border circle: the ring fills to score/100 and
  // sweeps in on load (`from { stroke-dashoffset: var(--circ) }` — final
  // state lives in the base style, so print/reduced-motion render it
  // complete). Radius 25 at strokeWidth 3 inside a 56px box.
  const R = 25;
  const CIRC = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRC * (1 - clamped / 100);
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: 56, height: 56 }}
    >
      <svg
        width={56}
        height={56}
        viewBox="0 0 56 56"
        aria-hidden="true"
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={28}
          cy={28}
          r={R}
          fill="#FFFFFF"
          stroke="#f4f4f4"
          strokeWidth={3}
        />
        <circle
          className="aud-arc"
          cx={28}
          cy={28}
          r={R}
          fill="none"
          stroke={tone}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ ["--circ" as string]: `${CIRC}` }}
        />
      </svg>
      <style>{`
        @keyframes aud-arc-in { from { stroke-dashoffset: var(--circ); } }
        .aud-arc { animation: aud-arc-in 900ms cubic-bezier(.2,.8,.2,1) 200ms backwards; }
      `}</style>
      <span
        className="relative text-[16px] font-semibold tabular-nums"
        style={{ color: "#161616" }}
      >
        {score}
      </span>
    </div>
  );
}

// ===========================================================================
// Schema markup gap
// ===========================================================================

export function SchemaGapCard({ findings }: { findings: SchemaGap }) {
  const noneDetected = findings.present.length === 0;
  return (
    <section className="mt-10" aria-label="Schema markup">
      <Eyebrow>Structured data · schema.org</Eyebrow>
      <H2>Schema markup AI engines can read off your homepage</H2>
      <p
        className="mt-1.5 text-[12.5px] max-w-2xl"
        style={{ color: "#6f6f6f" }}
      >
        AI engines disproportionately quote pages with structured data they
        can attribute to a real entity. Here&apos;s what we found, and
        what high-AEO-signal types you&apos;re missing.
      </p>

      <div
        className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        aria-label="Present vs missing schema types"
      >
        <ColumnCard
          eyebrow="Present"
          tone="ok"
          empty={
            noneDetected
              ? "No JSON-LD detected. AI engines have no entity to attribute citations to."
              : null
          }
          items={findings.present}
        />
        <ColumnCard
          eyebrow="Missing — high-AEO-signal types"
          tone="warn"
          empty={
            findings.missing.length === 0
              ? "You already ship every recommended type."
              : null
          }
          items={findings.missing}
        />
      </div>
    </section>
  );
}

function ColumnCard({
  eyebrow,
  tone,
  items,
  empty,
}: {
  eyebrow: string;
  tone: "ok" | "warn";
  items: string[];
  empty: string | null;
}) {
  const accent = tone === "ok" ? "#0e6027" : "#B45309";
  const Icon = tone === "ok" ? ShieldCheck : AlertCircle;
  return (
    <div
      className="rounded-[2px]"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #e0e0e0",
        padding: "16px 18px",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} aria-hidden />
        <span
          className="text-[10px] font-mono uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </span>
      </div>
      {empty ? (
        <p
          className="mt-2 text-[12.5px]"
          style={{ color: "#6f6f6f" }}
        >
          {empty}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((t) => (
            <li key={t}>
              <a
                href={`https://schema.org/${encodeURIComponent(t)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full hover:underline"
                style={{
                  backgroundColor: "#FBFBFD",
                  border: "1px solid #e0e0e0",
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#161616",
                }}
                title={`View ${t} on schema.org`}
              >
                {t}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ===========================================================================
// Detected stack — what we observed on the homepage
// ===========================================================================

export function DetectedStackCard({
  findings,
}: {
  findings: DetectedStack;
}) {
  return (
    <section className="mt-10" aria-label="Detected conversion stack">
      <Eyebrow>What we found on your homepage</Eyebrow>
      <H2>Your live conversion stack</H2>
      <p
        className="mt-1.5 text-[12.5px] max-w-2xl"
        style={{ color: "#6f6f6f" }}
      >
        We scanned the rendered HTML for known chatbot, popup, pixel,
        analytics, and CRM widgets. The categories below reflect what
        is currently installed and loading on your homepage.
      </p>

      <ul className="mt-4 space-y-2">
        {findings.rows.map((r) => (
          <li
            key={r.key}
            className="flex items-start gap-3 rounded-[2px]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #e0e0e0",
              padding: "12px 16px",
            }}
          >
            <span
              aria-hidden
              className="mt-1 shrink-0"
              style={{
                width: 8,
                height: 8,
                borderRadius: "9999px",
                backgroundColor: r.detected ? "#0e6027" : "#c6c6c6",
              }}
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px]"
                style={{ color: "#161616", fontWeight: 500 }}
              >
                {r.label}
              </p>
              <p
                className="text-[11.5px] mt-0.5"
                style={{ color: r.detected ? "#161616" : "#6f6f6f" }}
              >
                {r.note}
              </p>
            </div>
            <span
              className="inline-flex items-center text-[10px] font-mono uppercase tracking-[0.14em] shrink-0"
              style={{
                color: r.detected ? "#0e6027" : "#a8a8a8",
              }}
            >
              {r.detected ? "Detected" : "Not detected"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ===========================================================================
// Shared chip used by GoogleAiOverviewCard
// ===========================================================================

function CitedChip({ cited }: { cited: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full shrink-0"
      style={{
        padding: "3px 9px 3px 7px",
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: cited ? "#edf5ff" : "#fff1f1",
        color: cited ? "#0043ce" : "#a2191f",
        border: `1px solid ${cited ? "#d0e2ff" : "#ffd7d9"}`,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {cited ? (
        <Check className="w-3 h-3" aria-hidden />
      ) : (
        <X className="w-3 h-3" aria-hidden />
      )}
      {cited ? "You cited" : "Not cited"}
    </span>
  );
}
