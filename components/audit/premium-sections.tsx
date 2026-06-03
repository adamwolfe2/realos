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
// Brand rules: light only, no emojis, no dark surfaces, ink #1E2A3A,
// accent #2563EB, hairline #E5E7EB, muted #6B7280.
// ---------------------------------------------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-mono uppercase tracking-[0.16em]"
      style={{ color: "#2563EB" }}
    >
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-1.5 text-xl sm:text-2xl font-semibold tracking-tight"
      style={{ color: "#1E2A3A" }}
    >
      {children}
    </h2>
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
    <section className="mt-10" aria-label="Google AI Overview">
      <Eyebrow>Google AI Overview · verbatim capture</Eyebrow>
      <H2>What Google&apos;s AI Overview says about {brandName} today</H2>
      <p
        className="mt-1.5 text-[12.5px] max-w-2xl"
        style={{ color: "#6B7280" }}
      >
        We queried Google directly for &quot;{findings.query}&quot; and captured the
        AI Overview shown to searchers. The text below is the engine&apos;s
        verbatim answer, with the sources it cited.
      </p>

      <div
        className="mt-4 rounded-2xl"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
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
                color: "#1E2A3A",
              }}
            >
              Google · AI Overview
            </span>
          </div>
          <CitedChip cited={findings.cited} />
        </div>

        <blockquote
          className="mt-3 text-[14px] leading-relaxed"
          style={{
            color: "#1E2A3A",
            borderLeft: "3px solid #2563EB",
            paddingLeft: 14,
            fontStyle: "italic",
          }}
        >
          &ldquo;{findings.summary}&rdquo;
        </blockquote>

        {findings.citedUrls.length > 0 ? (
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid #E5E7EB" }}>
            <p
              className="text-[10px] font-mono uppercase tracking-[0.14em]"
              style={{ color: "#6B7280" }}
            >
              Sources Google cited
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
              {findings.citedUrls.slice(0, 6).map((u) => (
                <li
                  key={u}
                  className="inline-flex items-center gap-1 text-[12px]"
                  style={{ color: "#1E2A3A" }}
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: "#1E2A3A" }}
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
            style={{ color: "#1E2A3A", fontWeight: 500 }}
          >
            <span style={{ color: "#DC2626", fontWeight: 600 }}>
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
        style={{ color: "#6B7280" }}
      >
        Eight structured-data and content signals AI engines reward when
        deciding which pages to quote. Same scorecard our AEO Boost
        customers run daily.
      </p>

      <div
        className="mt-4 rounded-2xl"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
          padding: "18px 20px",
        }}
      >
        <div className="flex items-center gap-4">
          <ScoreRing score={findings.score} />
          <div className="flex-1 min-w-0">
            <p
              className="text-[13.5px]"
              style={{ color: "#1E2A3A", fontWeight: 500 }}
            >
              {passCount} of {total} checks passing
            </p>
            <p
              className="text-[11.5px] mt-0.5 truncate"
              style={{ color: "#6B7280" }}
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
              style={{ borderTop: "1px solid #F3F4F6" }}
            >
              <span className="mt-0.5 shrink-0">
                {c.pass ? (
                  <Check className="w-3.5 h-3.5" style={{ color: "#059669" }} />
                ) : (
                  <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px]"
                  style={{ color: "#1E2A3A", fontWeight: 500 }}
                >
                  {c.label}
                </p>
                <p
                  className="text-[11.5px] mt-0.5"
                  style={{ color: "#6B7280" }}
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
    score >= 75 ? "#059669" : score >= 50 ? "#2563EB" : "#DC2626";
  return (
    <div
      className="inline-flex items-center justify-center"
      style={{
        width: 56,
        height: 56,
        borderRadius: "9999px",
        border: `3px solid ${tone}`,
        backgroundColor: "#FFFFFF",
      }}
    >
      <span
        className="text-[16px] font-semibold tabular-nums"
        style={{ color: "#1E2A3A" }}
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
        style={{ color: "#6B7280" }}
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
  const accent = tone === "ok" ? "#059669" : "#B45309";
  const Icon = tone === "ok" ? ShieldCheck : AlertCircle;
  return (
    <div
      className="rounded-xl"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
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
          style={{ color: "#6B7280" }}
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
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E5E7EB",
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#1E2A3A",
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
      <H2>Observed, not asked</H2>
      <p
        className="mt-1.5 text-[12.5px] max-w-2xl"
        style={{ color: "#6B7280" }}
      >
        We scanned the rendered HTML for known chatbot, popup, pixel,
        analytics, and CRM widgets. These are facts about your live site —
        not quiz answers.
      </p>

      <ul className="mt-4 space-y-2">
        {findings.rows.map((r) => (
          <li
            key={r.key}
            className="flex items-start gap-3 rounded-xl"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
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
                backgroundColor: r.detected ? "#059669" : "#D1D5DB",
              }}
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px]"
                style={{ color: "#1E2A3A", fontWeight: 500 }}
              >
                {r.label}
              </p>
              <p
                className="text-[11.5px] mt-0.5"
                style={{ color: r.detected ? "#1E2A3A" : "#6B7280" }}
              >
                {r.note}
              </p>
            </div>
            <span
              className="inline-flex items-center text-[10px] font-mono uppercase tracking-[0.14em] shrink-0"
              style={{
                color: r.detected ? "#059669" : "#9CA3AF",
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
        backgroundColor: cited ? "#EBF3FF" : "#FEF2F2",
        color: cited ? "#1D4ED8" : "#B91C1C",
        border: `1px solid ${cited ? "#CFE2FF" : "#FECACA"}`,
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
