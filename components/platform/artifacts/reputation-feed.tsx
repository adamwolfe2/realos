"use client";

import React from "react";
import {
  siReddit,
  siYelp,
  siGoogle,
  siFacebook,
} from "simple-icons";

type SiIcon = { path: string; title: string };

// ---------------------------------------------------------------------------
// ReputationFeed — public-mention feed across review + social sources.
//
// CapabilitiesRail #5 artifact. Stacked card layout: header strip + 4
// mention rows + small footer chip. Each row shows source badge (color
// from the source's brand palette), title, snippet, sentiment dot, and
// relative time.
//
// No data dependency — the marketing demo is intentionally static and
// hand-curated to read well at the rail's medium scroll-speed. Live
// data flows through /portal/reputation and /audit/[token].
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#8d8d8d";
const BORDER = "#e0e0e0";
const BORDER_SOFT = "#e0e0e0";
const CARD_BG = "#FFFFFF";

type Sentiment = "positive" | "neutral" | "negative";

type Source = "reddit" | "yelp" | "google" | "bbb" | "apartments" | "facebook";

type Mention = {
  source: Source;
  title: string;
  snippet: string;
  ago: string;
  sentiment: Sentiment;
};

// Curated, plausible — modeled on real telegraphcommons.com / multifamily
// chatter. Sources spread across the rail's most-trusted set.
const MENTIONS: Mention[] = [
  {
    source: "reddit",
    title: "r/berkeley — looking for fall housing",
    snippet:
      "Student Central came up a few times. Anyone here actually lived there?",
    ago: "3d",
    sentiment: "neutral",
  },
  {
    source: "google",
    title: "Google review — 5 stars",
    snippet:
      "Tour was quick, leasing team responded same day. Move-in was painless.",
    ago: "1w",
    sentiment: "positive",
  },
  {
    source: "yelp",
    title: "Yelp — 2 stars",
    snippet:
      "Maintenance request took 9 days. Front desk was helpful, the rest wasn't.",
    ago: "2w",
    sentiment: "negative",
  },
  {
    source: "apartments",
    title: "ApartmentRatings — 4 stars",
    snippet:
      "Great spot for students looking for low-income housing near campus.",
    ago: "5w",
    sentiment: "positive",
  },
];

const SOURCE_COLOR: Record<Source, string> = {
  reddit: "#FF4500",
  yelp: "#D32323",
  google: "#4285F4",
  bbb: "#0F4C81",
  apartments: "#24a148",
  facebook: "#1877F2",
};

// Real brand glyphs where simple-icons covers them. ApartmentRatings + BBB
// aren't in simple-icons (too niche), so we fall back to tight uppercase
// letterforms on their brand color — still reads as "logo" at this size.
const SOURCE_ICON: Record<Source, SiIcon | null> = {
  reddit: siReddit,
  yelp: siYelp,
  google: siGoogle,
  facebook: siFacebook,
  bbb: null,
  apartments: null,
};

const SOURCE_LETTER: Record<Source, string> = {
  reddit: "R",
  yelp: "Y",
  google: "G",
  bbb: "BBB",
  apartments: "AR",
  facebook: "F",
};

function SourceGlyph({
  source,
  size,
  letterFontSize,
}: {
  source: Source;
  size: number;
  letterFontSize: number;
}) {
  const icon = SOURCE_ICON[source];
  if (icon) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        aria-label={icon.title}
        style={{ display: "block" }}
      >
        <path d={icon.path} fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <span
      style={{
        color: "#FFFFFF",
        fontSize: letterFontSize,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      {SOURCE_LETTER[source]}
    </span>
  );
}

const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: "#24a148",
  neutral: "#8d8d8d",
  negative: "#da1e28",
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export function ReputationFeed() {
  return (
    <div
      className="w-full rounded-[2px] overflow-hidden shadow-sm"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${BORDER}`,
        fontFamily: "var(--font-sans)",
        color: INK,
      }}
      aria-label="Reputation feed across review sites"
      role="region"
    >
      {/* Header strip */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${BORDER_SOFT}` }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#0f62fe",
              animation: "reputationDot 2s ease-in-out infinite",
            }}
            aria-hidden="true"
          />
          <p
            className="font-semibold"
            style={{ fontSize: 13, letterSpacing: "-0.005em" }}
          >
            Past 90 days
          </p>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {(["reddit", "google", "yelp", "apartments", "bbb", "facebook"] as Source[]).map(
            (s) => (
              <span
                key={s}
                className="inline-flex items-center justify-center shrink-0"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 2,
                  backgroundColor: SOURCE_COLOR[s],
                }}
                title={s.charAt(0).toUpperCase() + s.slice(1)}
              >
                <SourceGlyph source={s} size={12} letterFontSize={8.5} />
              </span>
            ),
          )}
        </div>
      </div>

      {/* Mention rows */}
      <ul className="divide-y" style={{ borderColor: BORDER_SOFT }}>
        {MENTIONS.map((m, i) => (
          <li
            key={i}
            className="px-5 py-3 flex items-start gap-3"
            style={{ borderColor: BORDER_SOFT }}
          >
            <span
              className="inline-flex items-center justify-center shrink-0 mt-0.5"
              style={{
                width: 30,
                height: 30,
                borderRadius: 2,
                backgroundColor: SOURCE_COLOR[m.source],
              }}
              aria-hidden="true"
            >
              <SourceGlyph source={m.source} size={17} letterFontSize={10.5} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className="truncate font-medium"
                  style={{ fontSize: 12.5, color: INK }}
                >
                  {m.title}
                </p>
                <span
                  className="shrink-0 tabular-nums"
                  style={{ fontSize: 11, color: MUTED }}
                >
                  {m.ago}
                </span>
              </div>
              <p
                className="mt-0.5 truncate"
                style={{ fontSize: 12, color: "#525252", lineHeight: 1.45 }}
              >
                {m.snippet}
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 shrink-0 mt-1"
              style={{ fontSize: 10.5, color: MUTED }}
              aria-label={`Sentiment: ${SENTIMENT_LABEL[m.sentiment]}`}
            >
              <span
                className="inline-block"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: SENTIMENT_COLOR[m.sentiment],
                }}
                aria-hidden="true"
              />
              {SENTIMENT_LABEL[m.sentiment]}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer summary */}
      <div
        className="px-5 py-2.5 flex items-center justify-between"
        style={{
          borderTop: `1px solid ${BORDER_SOFT}`,
          backgroundColor: "#f4f4f4",
        }}
      >
        <p style={{ fontSize: 11, color: MUTED }}>
          14 mentions · 9 positive · 3 neutral · 2 negative
        </p>
        <p
          style={{
            fontSize: 11,
            color: "#0f62fe",
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          One-click reply &rarr;
        </p>
      </div>

      <style>{`
        @keyframes reputationDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
