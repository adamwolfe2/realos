import * as React from "react";
import { Check, X, ExternalLink } from "lucide-react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { COMPETITOR_URLS } from "@/components/audit/brief-shell";
import type { AeoEngineRow } from "@/lib/audit/synthesize";

// ---------------------------------------------------------------------------
// AeoEngineBreakdown — per-engine "did the AI name you?" card.
//
// One row per engine, official mark on the left, "Cited" / "Not cited"
// chip on the right. When cited, expands to show the source URLs the
// engine returned. When not cited and competitors were named, those are
// shown below in a separate strip.
//
// Why this section earns its space: every other audit section reads as a
// score. This one reads as a verdict. "Three of four major AI engines do
// not name your property when asked about your market." That sentence,
// supported by per-engine breakdowns, is what gets the executive on the
// phone.
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<AeoEngineRow["engine"], string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

function EngineMark({
  engine,
  size = 22,
}: {
  engine: AeoEngineRow["engine"];
  size?: number;
}) {
  switch (engine) {
    case "CHATGPT":
      return <ChatGPTMark size={size} />;
    case "PERPLEXITY":
      return <PerplexityMark size={size} />;
    case "CLAUDE":
      return <ClaudeMark size={size} />;
    case "GEMINI":
      return <GeminiMark size={size} />;
  }
}

export type AeoEngineBreakdownProps = {
  rows: AeoEngineRow[];
  /** Top competitor names AI engines surfaced INSTEAD of the brand.
   *  Shown as a chip strip below the engine cards. */
  competitorsCited: string[];
  brandName: string;
};

export function AeoEngineBreakdown({
  rows,
  competitorsCited,
  brandName,
}: AeoEngineBreakdownProps) {
  const citedCount = rows.filter((r) => r.cited).length;
  const total = rows.length;
  const allCited = citedCount === total && total > 0;
  const noneCited = citedCount === 0 && total > 0;

  // Headline. Reads as a verdict, not a score.
  const headline = allCited
    ? `Every AI engine names ${brandName} today.`
    : noneCited
      ? `${total} of ${total} major AI engines do NOT name ${brandName}.`
      : `${total - citedCount} of ${total} major AI engines do not name ${brandName} today.`;

  return (
    <section className="mt-10" aria-label="AI search citation per engine">
      <Heading>Where AI search engines name you</Heading>
      <p
        className="mt-2 text-[14.5px] leading-relaxed max-w-2xl"
        style={{ color: "#1E2A3A", fontWeight: 500 }}
      >
        {headline}
      </p>
      <p
        className="mt-1 text-[12.5px] max-w-2xl"
        style={{ color: "#6B7280" }}
      >
        We asked each engine the same five buyer-intent prompts your
        prospects would type. Below: who named you, who didn&apos;t, and
        the URLs each engine actually cited.
      </p>

      <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {rows.map((row) => (
          <EngineCard key={row.engine} row={row} />
        ))}
      </ul>

      {competitorsCited.length > 0 ? (
        <div
          className="mt-5 rounded-xl"
          style={{
            backgroundColor: "#FBFBFD",
            border: "1px solid #E5E7EB",
            padding: "14px 16px",
          }}
        >
          <p
            className="text-[10px] font-mono uppercase tracking-[0.14em]"
            style={{ color: "#2563EB" }}
          >
            When AI didn&apos;t name you, it named these
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {competitorsCited.slice(0, 10).map((name) => {
              const href = COMPETITOR_URLS[name];
              if (href) {
                return (
                  <li key={name}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full hover:underline"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        padding: "5px 10px",
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#1E2A3A",
                      }}
                      title={`${name} — visit website`}
                    >
                      {name}
                      <ExternalLink
                        className="w-3 h-3"
                        style={{ color: "#94A3B8" }}
                        aria-hidden
                      />
                    </a>
                  </li>
                );
              }
              return (
                <li
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    padding: "5px 10px",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#1E2A3A",
                  }}
                >
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function EngineCard({ row }: { row: AeoEngineRow }) {
  const cited = row.cited;
  return (
    <li
      className="rounded-xl flex flex-col"
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${cited ? "#CFE2FF" : "#E5E7EB"}`,
        padding: "14px 16px",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <EngineMark engine={row.engine} size={22} />
          <span
            className="text-[14px] font-semibold truncate"
            style={{ color: "#1E2A3A" }}
          >
            {ENGINE_LABELS[row.engine]}
          </span>
        </div>
        <CitedChip cited={cited} />
      </div>

      {cited ? (
        row.sources.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {row.sources.slice(0, 3).map((u) => (
              <li
                key={u}
                className="flex items-center gap-1.5 text-[11.5px]"
                style={{ color: "#4B5563" }}
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate hover:underline"
                  style={{ color: "#1E2A3A" }}
                  title={u}
                >
                  {safeHost(u)}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="mt-3 text-[12px]"
            style={{ color: "#6B7280" }}
          >
            Named in the answer. No URL returned.
          </p>
        )
      ) : (
        <p
          className="mt-3 text-[12px]"
          style={{ color: "#6B7280" }}
        >
          The engine answered the prompt without naming your property.
        </p>
      )}
    </li>
  );
}

function CitedChip({ cited }: { cited: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full shrink-0"
      style={{
        padding: "3px 9px 3px 7px",
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: cited ? "#EBF3FF" : "#F3F4F6",
        color: cited ? "#1D4ED8" : "#4B5563",
        border: `1px solid ${cited ? "#CFE2FF" : "#E5E7EB"}`,
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
      {cited ? "Cited" : "Not cited"}
    </span>
  );
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-[10px] font-mono uppercase tracking-[0.16em]"
        style={{ color: "#2563EB" }}
      >
        AI search visibility
      </p>
      <h2
        className="mt-1.5 text-xl sm:text-2xl font-semibold tracking-tight"
        style={{ color: "#1E2A3A" }}
      >
        {children}
      </h2>
    </div>
  );
}
