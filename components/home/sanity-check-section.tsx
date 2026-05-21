"use client";

import * as React from "react";
import { StickyArtifactSection } from "@/components/platform/sticky-artifact-section";

// ---------------------------------------------------------------------------
// SanityCheckSection — the Judgment-Labs-style "calm sticky text + dense
// product artifact" section. Norman's 2026-05-21 inspiration brief asked
// for this pattern as the "cleanliness" anchor on the home page.
//
// This isn't a generic UI — the surface is intentionally LeaseStack
// content (reputation triage), but the structural rhythm is the one from
// judgmentlabs.ai/products. The artifact card on the right mirrors the
// Judgment "Refund Guard Judge" panel: tight stat row at the top, a list
// of pass/fail items below, no decorative chrome.
// ---------------------------------------------------------------------------

export function SanityCheckSection() {
  return (
    <StickyArtifactSection
      surface="muted"
      eyebrow="LIVE INSIGHTS"
      title={
        <>
          Catch the bad reviews before
          <br />
          your owners do.
        </>
      }
      body="Every Google, Yelp, Reddit, and forum mention is pulled into one feed and classified for sentiment. Negative reviews get auto-flagged the moment they land — drafted responses sit there, ready to send, so the operator never has to write from scratch at 11pm."
      bullets={[
        "5-year fuse on direct reviews · 6-month fuse on general threads",
        "Auto-drafted replies tuned for residential, not hotel",
        "Reviewed mentions sink to the bottom — worklist stays clean",
      ]}
      cta={{ label: "See the reputation surface", href: "/portal/reputation" }}
      artifact={<ReputationArtifact />}
    />
  );
}

// ---------------------------------------------------------------------------
// Artifact — a calm, paper-feeling mockup of the live reputation feed.
// Mirrors the Judgment "Refund Guard Judge" panel: stat row at the top,
// a list of items beneath, tight padding, no shadow, no decorative
// chrome. Brand-blue accents only.
// ---------------------------------------------------------------------------

function ReputationArtifact() {
  return (
    <div
      className="rounded-2xl bg-white"
      style={{
        border: "1px solid #E5E9F2",
      }}
    >
      {/* Header */}
      <header
        className="flex items-baseline justify-between gap-3 px-5 py-4 border-b"
        style={{ borderColor: "#F1F5F9" }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "#94A3B8",
            }}
          >
            Telegraph Commons · Last 30 days
          </p>
          <h3
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: "-0.012em",
              color: "#1E2A3A",
            }}
          >
            Reputation feed
          </h3>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5"
          style={{
            backgroundColor: "#EFF6FF",
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.06em",
            fontWeight: 600,
          }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#2563EB" }}
          />
          LIVE
        </span>
      </header>

      {/* Stat row */}
      <section
        className="grid grid-cols-3 px-5 py-4 border-b"
        style={{ borderColor: "#F1F5F9" }}
      >
        <Stat label="Active mentions" value="24" hint="+6 in 30d" />
        <Stat label="% Negative" value="12%" hint="vs 18% prior" />
        <Stat label="Needs response" value="3" hint="oldest 2d" />
      </section>

      {/* Feed list */}
      <ul>
        <FeedItem
          source="Google"
          rating={1}
          author="Maya R."
          when="2 days ago"
          excerpt="The leasing office closed 30 minutes early without notice. Third time this month."
          status="needs-reply"
        />
        <FeedItem
          source="Reddit"
          rating={null}
          author="r/berkeley"
          when="5 days ago"
          excerpt="Anyone live at Telegraph Commons? Quiet hours actually enforced?"
          status="watch"
        />
        <FeedItem
          source="Google"
          rating={5}
          author="James K."
          when="1 week ago"
          excerpt="Renewed for a third year. Maintenance fixes the dryer same day every time."
          status="positive"
        />
        <FeedItem
          source="Yelp"
          rating={4}
          author="Priya M."
          when="2 weeks ago"
          excerpt="Solid building, fair rent, friendly staff. Wish parking was easier."
          status="reviewed"
          muted
        />
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border-r last:border-r-0 pr-4 last:pr-0" style={{ borderColor: "#F1F5F9" }}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 500,
          color: "#94A3B8",
        }}
      >
        {label}
      </p>
      <p
        className="mt-1"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 24,
          fontWeight: 400,
          letterSpacing: "-0.022em",
          color: "#1E2A3A",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      <p
        className="mt-1.5"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          color: "#94A3B8",
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function FeedItem({
  source,
  rating,
  author,
  when,
  excerpt,
  status,
  muted,
}: {
  source: string;
  rating: number | null;
  author: string;
  when: string;
  excerpt: string;
  status: "needs-reply" | "watch" | "positive" | "reviewed";
  muted?: boolean;
}) {
  const statusMeta: Record<
    typeof status,
    { label: string; tone: "blue" | "muted" }
  > = {
    "needs-reply": { label: "Draft reply", tone: "blue" },
    watch: { label: "Watching", tone: "muted" },
    positive: { label: "Positive", tone: "muted" },
    reviewed: { label: "Reviewed", tone: "muted" },
  };
  const s = statusMeta[status];
  return (
    <li
      className="px-5 py-3.5 border-b last:border-b-0"
      style={{
        borderColor: "#F1F5F9",
        opacity: muted ? 0.55 : 1,
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div
          className="flex items-baseline gap-2 min-w-0"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#94A3B8",
          }}
        >
          <span style={{ color: "#1E2A3A", fontWeight: 600 }}>{source}</span>
          {rating != null ? (
            <span style={{ color: "#2563EB" }}>{"★".repeat(rating)}</span>
          ) : null}
          <span>·</span>
          <span className="truncate">{author}</span>
          <span>·</span>
          <span>{when}</span>
        </div>
        <span
          className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            letterSpacing: "0.08em",
            fontWeight: 600,
            textTransform: "uppercase",
            color: s.tone === "blue" ? "#2563EB" : "#94A3B8",
            backgroundColor: s.tone === "blue" ? "#EFF6FF" : "#F8FAFC",
          }}
        >
          {s.label}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "#475569",
        }}
      >
        {excerpt}
      </p>
    </li>
  );
}
