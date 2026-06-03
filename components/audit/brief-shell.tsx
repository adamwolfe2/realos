import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
  GoogleMark,
} from "@/components/platform/artifacts/brand-logos";
import { BRAND_NAME } from "@/lib/brand";

// ---------------------------------------------------------------------------
// Shared visual shell for both /brief/[token] (hand-curated) and
// /audit/[token] (live pipeline output). The two routes have different
// data sources, but the visual identity is one design system:
//
//   • LeaseStack wordmark header
//   • Light brand-blue narrative treatment (no dark backgrounds)
//   • Source attribution everywhere
//   • Light footer with audit/brief id
//
// Components in this file are pure presentation. Data comes in via
// props; no DB calls, no fetches. Both routes wrap their content
// between <BriefShellHeader/> and <BriefShellFooter/> + drop in
// <BriefNarrativePanel/>, <BriefSourcesBlock/>, etc as needed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// COMPETITOR_URLS — shared lookup so any audit / brief surface can
// linkify a building or competitor name to its marketing site. Extend
// freely; missing entries fall back to plain text.
// ---------------------------------------------------------------------------
export const COMPETITOR_URLS: Record<string, string> = {
  // SF Class-A office (255 Cal brief comp set)
  "555 California Street": "https://www.555california.com/",
  "101 California Street": "https://www.101california.com/",
  "Salesforce Tower": "https://www.salesforcetower.com/",
  "Transamerica Pyramid": "https://www.thetransamericapyramid.com/",
  "50 California Street": "https://www.50cal.com/",
  "One Market Plaza": "https://www.onemarketplaza.com/",
  "Embarcadero Center": "https://www.embarcaderocenter.com/",
};

// Deep-link templates that let a reader run the exact same prompt
// against an engine themselves. Trust by traceability.
export function engineRunUrl(
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI",
  prompt: string,
): string {
  const q = encodeURIComponent(prompt);
  switch (engine) {
    case "CHATGPT":
      return `https://chatgpt.com/?q=${q}`;
    case "PERPLEXITY":
      return `https://www.perplexity.ai/search/new?q=${q}`;
    case "CLAUDE":
      return `https://claude.ai/new?q=${q}`;
    case "GEMINI":
      return `https://gemini.google.com/app?q=${q}`;
  }
}

// ---------------------------------------------------------------------------
// HEADER — wordmark on left, confidential strip on right. Light.
// ---------------------------------------------------------------------------
export function BriefShellHeader({
  subjectName,
  generatedAtIso,
  label = "Audit",
}: {
  /** Display name of the prospect / property the report is about. */
  subjectName: string;
  generatedAtIso: string;
  /** Pill label — "Audit" on /audit, "Prospect brief" on /brief. */
  label?: string;
}) {
  return (
    <header
      style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
        padding: "16px 0",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 flex items-center justify-between gap-4">
        <Link href="/" aria-label={`${BRAND_NAME} home`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/leasestack-wordmark.png"
            alt={BRAND_NAME}
            className="h-7 md:h-9 w-auto block"
          />
        </Link>
        <div
          className="flex items-center gap-3 text-[10.5px]"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: "#2563EB", fontWeight: 600 }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 9999,
                backgroundColor: "#2563EB",
              }}
            />
            {label}
          </span>
          <span aria-hidden style={{ color: "#CBD5E1" }}>
            ·
          </span>
          <span style={{ color: "#6B7280" }}>Confidential</span>
          <span
            aria-hidden
            style={{ color: "#CBD5E1" }}
            className="hidden sm:inline"
          >
            ·
          </span>
          <span style={{ color: "#6B7280" }} className="hidden sm:inline">
            {subjectName}
          </span>
          <span
            aria-hidden
            style={{ color: "#CBD5E1" }}
            className="hidden md:inline"
          >
            ·
          </span>
          <span style={{ color: "#6B7280" }} className="hidden md:inline">
            {formatDate(generatedAtIso)}
          </span>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// FOOTER — light, wordmark + traceability metadata.
// ---------------------------------------------------------------------------
export function BriefShellFooter({
  reportId,
  generatedAtIso,
  liveApiCalls,
}: {
  reportId: string;
  generatedAtIso: string;
  /** Number of live API calls that produced the report. */
  liveApiCalls: number;
}) {
  return (
    <footer
      style={{
        backgroundColor: "#F9FAFB",
        borderTop: "1px solid #E5E7EB",
        padding: "32px 0",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <Link href="/" aria-label={`${BRAND_NAME} home`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/leasestack-wordmark.png"
            alt={BRAND_NAME}
            className="h-6 w-auto block"
            style={{ opacity: 0.7 }}
          />
        </Link>
        <div
          className="flex flex-col md:flex-row gap-1 md:gap-3 md:items-center text-[11px]"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            color: "#6B7280",
          }}
        >
          <span>
            Report id{" "}
            <span style={{ color: "#1E2A3A", fontWeight: 600 }}>
              {reportId.slice(0, 12)}
            </span>
          </span>
          <span aria-hidden style={{ color: "#CBD5E1" }} className="hidden md:inline">
            ·
          </span>
          <span>generated {formatDate(generatedAtIso)}</span>
          {liveApiCalls > 0 ? (
            <>
              <span
                aria-hidden
                style={{ color: "#CBD5E1" }}
                className="hidden md:inline"
              >
                ·
              </span>
              <span>{liveApiCalls} live API calls</span>
            </>
          ) : null}
          <span aria-hidden style={{ color: "#CBD5E1" }} className="hidden md:inline">
            ·
          </span>
          <span>Confidential</span>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// NARRATIVE PANEL — light brand-blue panel for an executive "what this
// means" block. Replaces the dark navy treatment from the first /brief
// draft. Used inline anywhere a narrative paragraph belongs.
// ---------------------------------------------------------------------------
export function BriefNarrativePanel({
  eyebrow = "What this means",
  heading,
  children,
}: {
  eyebrow?: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        padding: "64px 0",
        borderBottom: "1px solid #F1F5F9",
        backgroundColor: "#EFF6FF",
      }}
    >
      <div className="max-w-[920px] mx-auto px-6">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "#2563EB" }}
        >
          {eyebrow}
        </p>
        <h2
          className="mt-3 text-2xl md:text-[32px] font-semibold leading-snug tracking-tight"
          style={{
            color: "#1E2A3A",
            letterSpacing: "-0.018em",
            fontFamily: "var(--font-display)",
            maxWidth: 760,
          }}
        >
          {heading}
        </h2>
        <div
          className="mt-6 space-y-4"
          style={{
            fontSize: 15.5,
            lineHeight: 1.65,
            color: "#1E2A3A",
            borderLeft: "3px solid #2563EB",
            paddingLeft: 22,
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SOURCES BLOCK — clickable cards for every data source the report
// touched. Each route assembles its own list (different providers) and
// hands it to this component.
// ---------------------------------------------------------------------------
export type BriefSource = {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
};

export function BriefSourcesBlock({
  sources,
  heading = "Every number here is traceable. Click any source to verify.",
}: {
  sources: BriefSource[];
  heading?: string;
}) {
  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: "1px solid #E5E7EB",
        backgroundColor: "#F9FAFB",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "#2563EB" }}
        >
          How this report was built
        </p>
        <h2
          className="mt-3 text-2xl md:text-[30px] font-semibold leading-tight tracking-tight"
          style={{
            color: "#1E2A3A",
            letterSpacing: "-0.018em",
            fontFamily: "var(--font-display)",
            maxWidth: 760,
          }}
        >
          {heading}
        </h2>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 14.5, lineHeight: 1.6, color: "#475569" }}
        >
          This report was produced from live API calls, not stock copy.
          Below: each data source we touched, with a link to the live
          surface so you can confirm any finding yourself.
        </p>

        <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sources.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl flex items-center gap-3 hover:border-[#CFE2FF] transition-colors"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  padding: "12px 16px",
                  textDecoration: "none",
                }}
              >
                <span className="shrink-0">{s.icon}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[13px] truncate"
                    style={{ color: "#1E2A3A", fontWeight: 600 }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="block mt-0.5 text-[11.5px] truncate"
                    style={{ color: "#6B7280" }}
                  >
                    {s.description}
                  </span>
                </span>
                <ExternalLink
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "#94A3B8" }}
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tiny shared icon for source items that don't have a brand mark.
// ---------------------------------------------------------------------------
export function SourceBullet({ inner = "#2563EB" }: { inner?: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{ width: 18, height: 18 }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          backgroundColor: "#F1F5F9",
          border: `1px solid ${inner}`,
          display: "inline-block",
        }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Re-exports for convenience — brand-logos used by sources blocks.
// ---------------------------------------------------------------------------
export { ChatGPTMark, PerplexityMark, ClaudeMark, GeminiMark, GoogleMark };

// ---------------------------------------------------------------------------
// Shared date formatter so timestamps render identically on both routes.
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}
