"use client";

import * as React from "react";
import { StickyArtifactSection } from "@/components/platform/sticky-artifact-section";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import {
  GoogleIcon,
  RedditIcon,
  YelpIcon,
  FacebookIcon,
} from "@/components/portal/reputation/source-logo";

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
      artifact={
        // Cluely-style soft lavender frame around the white mockup
        // (Norman feedback 2026-05-21). Adds the "lifted" floating-
        // card feel without darkening the surface or adding a heavy
        // drop shadow.
        <SoftFramedArtifact tone="lavender" padding="lg" pillLabel="LIVE">
          <ReputationArtifact />
        </SoftFramedArtifact>
      }
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
  // The SoftFramedArtifact wrapper provides the rounded-2xl shell +
  // soft shadow, so the inner content drops the duplicate border /
  // shell here. Keeps the dividers + padding for the internal
  // structure (header, stat row, feed items).
  return (
    <div className="bg-white">
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
        {/* LIVE pill moved out to the SoftFramedArtifact wrapper so the
            chip floats over the lavender frame instead of sitting
            inside the white card. */}
      </header>

      {/* Stat row */}
      {/* Mobile-first: 1 col on tiny viewports stacks the three stats so
          each one reads at full width, 3-up on sm+ matches the desktop
          comp. Avoids cramming three labels into a phone-narrow row. */}
      <section
        className="grid grid-cols-1 sm:grid-cols-3 px-5 py-4 border-b"
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
          source="Facebook"
          rating={null}
          author="Marcus T."
          when="10 days ago"
          excerpt="Tour was clean, leasing agent walked through every floor plan."
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

      {/* Source-coverage strip (Norman 2026-05-21): operators kept
          asking which platforms we monitor. Showing the live logo
          set inline below the feed answers it without taking another
          section of vertical real estate. */}
      <footer
        className="px-5 py-3 border-t flex items-center gap-3 flex-wrap"
        style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFF" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "#94A3B8",
          }}
        >
          Reading from
        </span>
        <span className="inline-flex items-center gap-2 opacity-90">
          <GoogleIcon className="h-3.5 w-3.5" />
          <YelpIcon className="h-3.5 w-3.5" />
          <RedditIcon className="h-3.5 w-3.5" />
          <FacebookIcon className="h-3.5 w-3.5" />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.08em",
              fontWeight: 500,
              color: "#94A3B8",
            }}
          >
            ApartmentRatings · BBB · Niche · news · forums
          </span>
        </span>
      </footer>
    </div>
  );
}

// Map a source string to its inline brand logo. Falls back to null
// (the FeedItem renders no icon when null) so adding a new source
// doesn't break the row.
function SourceIcon({ source }: { source: string }) {
  const className = "h-3 w-3 flex-shrink-0";
  switch (source.toLowerCase()) {
    case "google":
      return <GoogleIcon className={className} />;
    case "yelp":
      return <YelpIcon className={className} />;
    case "reddit":
      return <RedditIcon className={className} />;
    case "facebook":
      return <FacebookIcon className={className} />;
    default:
      return null;
  }
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
          className="flex items-center gap-2 min-w-0"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#94A3B8",
          }}
        >
          <SourceIcon source={source} />
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
