import * as React from "react";
import { Check, X, ExternalLink } from "lucide-react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { COMPETITOR_URLS } from "@/components/audit/brief-shell";
import { safeHttpUrl } from "@/lib/safe-url";
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
  /** 2026-08-13 discovery split. true = unbranded discovery prompts ran.
   *  false = NEW audit, branded-only fallback (location not derivable —
   *  we say so). undefined = legacy audit (old copy). */
  discoveryRan?: boolean;
  /** City the discovery prompts searched. */
  city?: string | null;
  /** Ranked competitor mentions across discovery answers (2026-08-14).
   *  When present, renders as a ranked bar list instead of flat chips —
   *  "who AI recommends instead, and how often." */
  competitorsRanked?: Array<{ name: string; mentions: number }>;
};

export function AeoEngineBreakdown({
  rows,
  competitorsCited,
  brandName,
  discoveryRan,
  city,
  competitorsRanked,
}: AeoEngineBreakdownProps) {
  const discovery = discoveryRan === true && rows.some((r) => r.discovered !== undefined);
  const citedCount = rows.filter((r) => r.cited).length;
  const total = rows.length;
  const allCited = citedCount === total && total > 0;
  const noneCited = citedCount === 0 && total > 0;
  // The sales wedge: engines that KNOW the property (cite its site on
  // branded prompts) but never recommend it in discovery answers.
  const awareNotDiscovered = discovery
    ? rows.filter((r) => r.discovered === false && r.aware).length
    : 0;

  // Headline. Reads as a verdict, not a score.
  const headline = discovery
    ? allCited
      ? `Every AI engine recommends ${brandName} to renters — unprompted.`
      : noneCited
        ? awareNotDiscovered > 0
          ? `AI engines know ${brandName} exists. None of them recommend it.`
          : `No major AI engine recommends ${brandName} when renters ask where to live.`
        : `${total - citedCount} of ${total} major AI engines never recommend ${brandName} when renters ask where to live.`
    : allCited
      ? `Every AI engine names ${brandName} today.`
      : noneCited
        ? `${total} of ${total} major AI engines do NOT name ${brandName}.`
        : `${total - citedCount} of ${total} major AI engines do not name ${brandName} today.`;

  const explainer = discovery
    ? `We asked each engine what a renter moving to ${city ?? "your market"} would ask — "best apartments," "which buildings should I tour" — without ever naming you, plus direct questions about ${brandName}. Below: who recommends you when nobody mentions your name.`
    : discoveryRan === false
      ? `We couldn't derive this property's location from its website, so this check covers brand-name questions only. Add a city to your homepage (address schema markup) for the full discovery check.`
      : `We asked each engine the same five buyer-intent prompts your prospects would type. Below: who named you, who didn't, and the URLs each engine actually cited.`;

  return (
    <section className="mt-10" aria-label="AI search citation per engine">
      <Heading>
        {discovery ? "Where AI recommends you — and where it doesn't" : "Where AI search engines name you"}
      </Heading>
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
        {explainer}
      </p>

      <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {rows.map((row) => (
          <EngineCard key={row.engine} row={row} />
        ))}
      </ul>

      {competitorsRanked && competitorsRanked.length > 0 ? (
        <CompetitorLeaderboard
          entries={competitorsRanked}
          city={city ?? null}
        />
      ) : competitorsCited.length > 0 ? (
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
            {discovery
              ? "When renters ask where to live, AI recommends these instead"
              : "When AI didn't name you, it named these"}
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

// ---------------------------------------------------------------------------
// CompetitorLeaderboard — ranked "who AI recommends instead" bar list
// (2026-08-14). Single-series magnitude → one hue, thin bars, mono
// numerals, direct labels, no legend. The single most screenshot-able
// element in the report: you vs the buildings AI actually pushes.
// ---------------------------------------------------------------------------

function CompetitorLeaderboard({
  entries,
  city,
}: {
  entries: Array<{ name: string; mentions: number }>;
  city: string | null;
}) {
  const max = Math.max(...entries.map((e) => e.mentions), 1);
  return (
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
        Who AI recommends{city ? ` in ${city}` : ""} instead
      </p>
      <p className="mt-1 text-[12px]" style={{ color: "#6B7280" }}>
        Times each competitor was named across the discovery answers above.
      </p>
      <ol className="mt-3 space-y-2">
        {entries.map((e) => {
          const href = COMPETITOR_URLS[e.name];
          return (
            <li key={e.name} className="flex items-center gap-3">
              <span
                className="w-40 sm:w-52 shrink-0 truncate text-[12.5px]"
                style={{ color: "#1E2A3A", fontWeight: 500 }}
                title={e.name}
              >
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {e.name}
                  </a>
                ) : (
                  e.name
                )}
              </span>
              <span
                className="flex-1 h-2 rounded-[2px] overflow-hidden"
                style={{ backgroundColor: "#E5E7EB" }}
                aria-hidden
              >
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${Math.max(6, (e.mentions / max) * 100)}%`,
                    backgroundColor: "#0f62fe",
                  }}
                />
              </span>
              <span
                className="w-6 text-right text-[12.5px] tabular-nums font-mono"
                style={{ color: "#1E2A3A" }}
              >
                {e.mentions}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type EngineVerdict = "recommends" | "aware_only" | "unknown" | "cited" | "not_cited";

function engineVerdict(row: AeoEngineRow): EngineVerdict {
  if (row.discovered === undefined) {
    return row.cited ? "cited" : "not_cited";
  }
  if (row.discovered) return "recommends";
  return row.aware ? "aware_only" : "unknown";
}

const VERDICT_BODY: Record<EngineVerdict, string> = {
  recommends:
    "Recommended your property in a discovery answer — a renter who'd never heard of you would.",
  aware_only:
    "Knows you exist — cites your site when asked directly — but never recommends you when renters ask where to live. It's sending them elsewhere.",
  unknown:
    "Never surfaced your property — not in discovery answers, and no source link even when asked about you directly.",
  cited: "Named in the answer. No URL returned.",
  not_cited: "The engine answered the prompt without naming your property.",
};

function EngineCard({ row }: { row: AeoEngineRow }) {
  const verdict = engineVerdict(row);
  const positive = verdict === "recommends" || verdict === "cited";
  return (
    <li
      className="rounded-xl flex flex-col"
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${positive ? "#CFE2FF" : "#E5E7EB"}`,
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
        <CitedChip verdict={verdict} />
      </div>

      {positive && row.sources.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {row.sources.slice(0, 3).map((u) => (
            <li
              key={u}
              className="flex items-center gap-1.5 text-[11.5px]"
              style={{ color: "#4B5563" }}
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              {safeHttpUrl(u) ? (
                <a
                  href={safeHttpUrl(u)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate hover:underline"
                  style={{ color: "#1E2A3A" }}
                  title={u}
                >
                  {safeHost(u)}
                </a>
              ) : (
                <span className="truncate" style={{ color: "#1E2A3A" }}>
                  {safeHost(u)}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12px]" style={{ color: "#6B7280" }}>
          {VERDICT_BODY[verdict]}
        </p>
      )}
    </li>
  );
}

const CHIP_STYLES: Record<
  EngineVerdict,
  { bg: string; fg: string; border: string; label: string; positive: boolean }
> = {
  recommends: {
    bg: "#EBF3FF",
    fg: "#1D4ED8",
    border: "#CFE2FF",
    label: "Recommends you",
    positive: true,
  },
  aware_only: {
    bg: "#FEF3C7",
    fg: "#92400E",
    border: "#FDE68A",
    label: "Knows you only",
    positive: false,
  },
  unknown: {
    bg: "#F3F4F6",
    fg: "#4B5563",
    border: "#E5E7EB",
    label: "Doesn't know you",
    positive: false,
  },
  cited: {
    bg: "#EBF3FF",
    fg: "#1D4ED8",
    border: "#CFE2FF",
    label: "Cited",
    positive: true,
  },
  not_cited: {
    bg: "#F3F4F6",
    fg: "#4B5563",
    border: "#E5E7EB",
    label: "Not cited",
    positive: false,
  },
};

function CitedChip({ verdict }: { verdict: EngineVerdict }) {
  const s = CHIP_STYLES[verdict];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full shrink-0"
      style={{
        padding: "3px 9px 3px 7px",
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {s.positive ? (
        <Check className="w-3 h-3" aria-hidden />
      ) : (
        <X className="w-3 h-3" aria-hidden />
      )}
      {s.label}
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
