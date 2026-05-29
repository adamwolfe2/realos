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
// 2026-05-21 (Adam): upgraded the artifact from a static screenshot into
// a live-feeling interactive demo. A scanner strip rotates through actual
// search queries we'd run on Google / Reddit / Yelp / ApartmentRatings,
// and the matching feed row briefly flashes when the scanner "lands" on
// that source — so the eye gets the cause/effect of "search → result
// found". Every reference to the property is highlighted in brand-blue
// + underlined, which is the visual hook the user asked for.
// ---------------------------------------------------------------------------

export function SanityCheckSection() {
  return (
    <StickyArtifactSection
      surface="muted"
      eyebrow="Reputation"
      title="Catch bad reviews before your owners do."
      body="Google, Yelp, Reddit, and forum mentions in one feed. Negatives flagged the moment they land, with a drafted reply ready to send."
      bullets={[
        "5 years of direct reviews, 6 months of forum threads",
        "Auto-drafted replies tuned for residential, not hotel",
        "Reviewed mentions sink so the worklist stays clean",
      ]}
      cta={{ label: "See the reputation surface", href: "/portal/reputation" }}
      artifact={
        <SoftFramedArtifact tone="lavender" padding="lg" pillLabel="LIVE">
          <ReputationArtifact />
        </SoftFramedArtifact>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Property branding + query script
// ---------------------------------------------------------------------------

const PROPERTY_NAME = "Telegraph Commons";

// Sources the scanner rotates through. `key` matches FeedItem.flashKey
// so the right row flashes when the scanner lands on it. `text` is the
// monospace query string we render in the scanner.
type SourceKey =
  | "google-maya"
  | "reddit"
  | "google-james"
  | "facebook"
  | "yelp"
  | "web";

const SCAN_QUERIES: Array<{
  key: SourceKey;
  domain: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "google-maya",
    domain: "google.com/maps",
    text: `"${PROPERTY_NAME}" Berkeley · reviews`,
    Icon: GoogleIcon,
  },
  {
    key: "reddit",
    domain: "reddit.com/r/berkeley",
    text: `"${PROPERTY_NAME}" quiet hours`,
    Icon: RedditIcon,
  },
  {
    key: "google-james",
    domain: "google.com/maps",
    text: `"${PROPERTY_NAME}" renewals`,
    Icon: GoogleIcon,
  },
  {
    key: "facebook",
    domain: "facebook.com",
    text: `"${PROPERTY_NAME}" tours`,
    Icon: FacebookIcon,
  },
  {
    key: "yelp",
    domain: "yelp.com/biz",
    text: `"${PROPERTY_NAME}" Berkeley`,
    Icon: YelpIcon,
  },
  {
    key: "web",
    domain: "apartmentratings.com",
    text: `"${PROPERTY_NAME}" residents`,
    // ApartmentRatings doesn't have its own colored glyph in source-logo,
    // so fall back to the Google one visually — the domain text carries
    // the meaning. Keeps the strip premium-looking without inventing
    // off-brand SVGs on the fly.
    Icon: GoogleIcon,
  },
];

// One full revolution every ~14.4s (6 sources × 2.4s). Slow enough to read
// each query, fast enough to feel alive without nagging the user.
const SCAN_INTERVAL_MS = 2400;
const FLASH_DELAY_MS = 700;

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// Drives the rotating scanner + the "found" flash on the matching row.
// Returns the active query and the source key currently flashing (null
// during the search-pending portion of the cycle).
function useLiveScanner(reduced: boolean) {
  const [queryIndex, setQueryIndex] = React.useState(0);
  const [flashKey, setFlashKey] = React.useState<SourceKey | null>(null);

  React.useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let nextTimer: ReturnType<typeof setTimeout> | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = (i: number) => {
      if (cancelled) return;
      setQueryIndex(i % SCAN_QUERIES.length);
      setFlashKey(null);

      // Flash the matching row mid-cycle so the eye reads
      // "search ran → result appeared".
      flashTimer = setTimeout(() => {
        if (cancelled) return;
        setFlashKey(SCAN_QUERIES[i % SCAN_QUERIES.length].key);
      }, FLASH_DELAY_MS);

      nextTimer = setTimeout(() => tick(i + 1), SCAN_INTERVAL_MS);
    };

    tick(0);

    return () => {
      cancelled = true;
      if (nextTimer) clearTimeout(nextTimer);
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, [reduced]);

  return { query: SCAN_QUERIES[queryIndex], queryIndex, flashKey };
}

// Counts a value up from `from` → `to` over `duration` ms once on mount.
// Used for the stat row so the numbers settle in instead of just sitting
// there — feels like the feed just finished its first scan.
function useCountUp(to: number, opts: { from?: number; duration?: number } = {}) {
  const { from = 0, duration = 900 } = opts;
  const [value, setValue] = React.useState(from);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, from, duration, reduced]);

  return value;
}

// ---------------------------------------------------------------------------
// Artifact — the live demo card
// ---------------------------------------------------------------------------

function ReputationArtifact() {
  const reduced = useReducedMotion();
  const { query, queryIndex, flashKey } = useLiveScanner(reduced);

  const activeMentions = useCountUp(24, { from: 18, duration: 1100 });
  const pctNegative = useCountUp(12, { from: 18, duration: 1100 });
  const needsResponse = useCountUp(3, { from: 0, duration: 900 });

  const QueryIcon = query.Icon;

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
            <Highlight>{PROPERTY_NAME}</Highlight>
            <span style={{ color: "#94A3B8" }}> · Last 30 days</span>
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
        {/* LIVE pill is rendered by SoftFramedArtifact wrapper. */}
      </header>

      {/* Live scanner — rotates through search queries every ~2.4s. */}
      <div
        className="flex items-center gap-2 px-5 py-2.5 border-b overflow-hidden"
        style={{
          borderColor: "#F1F5F9",
          backgroundColor: "#FAFBFF",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          lineHeight: 1.3,
          color: "#475569",
        }}
        aria-live="polite"
      >
        <PulseDot active={!reduced} />
        <span
          style={{
            color: "#94A3B8",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: 9.5,
            fontWeight: 600,
          }}
        >
          Scanning
        </span>
        {/* Key prop on the moving line so the crossfade re-fires per query. */}
        <span
          key={queryIndex}
          className={reduced ? undefined : "ls-rep-query-in"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flex: 1,
          }}
        >
          <QueryIcon className="h-3 w-3 flex-shrink-0" />
          <span
            style={{
              color: "#1E2A3A",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {query.domain}
          </span>
          <span style={{ color: "#CBD5E1" }} aria-hidden>·</span>
          <span
            className="truncate"
            style={{ color: "#475569", minWidth: 0 }}
          >
            {query.text}
          </span>
        </span>
        <span
          className="hidden sm:inline-flex items-center gap-1 shrink-0"
          style={{
            color: "#94A3B8",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: 9.5,
            fontWeight: 600,
          }}
        >
          <span
            className="inline-block h-1 w-1 rounded-full"
            style={{ backgroundColor: "#2563EB" }}
            aria-hidden
          />
          200 OK
        </span>
      </div>

      {/* Stat row — Norman May 22 mobile bug: was grid-cols-1 on
          mobile which stacked the 3 stats as full-width rows
          (Active mentions / % Negative / Needs response). Should
          stay horizontal on phone as a 1x3 row. */}
      <section
        className="grid grid-cols-3 sm:grid-cols-3 px-5 py-4 border-b gap-2"
        style={{ borderColor: "#F1F5F9" }}
      >
        <Stat
          label="Active mentions"
          value={String(activeMentions)}
          hint="+6 in 30d"
        />
        <Stat
          label="% Negative"
          value={`${pctNegative}%`}
          hint="vs 18% prior"
        />
        <Stat
          label="Needs response"
          value={String(needsResponse)}
          hint="oldest 2d"
        />
      </section>

      {/* Feed list */}
      <ul>
        <FeedItem
          source="Google"
          rating={1}
          author="Maya R."
          when="2 days ago"
          status="needs-reply"
          flashKey="google-maya"
          activeFlash={flashKey}
        >
          The <Highlight>{PROPERTY_NAME}</Highlight> leasing office closed 30
          minutes early without notice. Third time this month.
        </FeedItem>
        <FeedItem
          source="Reddit"
          rating={null}
          author="r/berkeley"
          when="5 days ago"
          status="watch"
          flashKey="reddit"
          activeFlash={flashKey}
        >
          Anyone live at <Highlight>{PROPERTY_NAME}</Highlight>? Quiet hours
          actually enforced?
        </FeedItem>
        <FeedItem
          source="Google"
          rating={5}
          author="James K."
          when="1 week ago"
          status="positive"
          flashKey="google-james"
          activeFlash={flashKey}
        >
          Renewed at <Highlight>{PROPERTY_NAME}</Highlight> for a third year.
          Maintenance fixes the dryer same day every time.
        </FeedItem>
        <FeedItem
          source="Facebook"
          rating={null}
          author="Marcus T."
          when="10 days ago"
          status="positive"
          flashKey="facebook"
          activeFlash={flashKey}
        >
          Toured <Highlight>{PROPERTY_NAME}</Highlight> today — clean, leasing
          agent walked through every floor plan.
        </FeedItem>
        <FeedItem
          source="Yelp"
          rating={4}
          author="Priya M."
          when="2 weeks ago"
          status="reviewed"
          muted
          flashKey="yelp"
          activeFlash={flashKey}
        >
          <Highlight>{PROPERTY_NAME}</Highlight> is a solid building, fair
          rent, friendly staff. Wish parking was easier.
        </FeedItem>
      </ul>

      {/* Source-coverage strip */}
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
            className="hidden sm:inline"
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
          <span
            className="sm:hidden"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.08em",
              fontWeight: 500,
              color: "#94A3B8",
            }}
          >
            + news, forums
          </span>
        </span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

// Highlights the property name (or any inline phrase) with a brand-blue
// underline. Designed to read as "this is the entity we're tracking" —
// blue with a soft underline weight, not a hard accent.
function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        color: "#2563EB",
        textDecoration: "underline",
        textDecorationColor: "rgba(37, 99, 235, 0.45)",
        textDecorationThickness: "1.5px",
        textUnderlineOffset: "2px",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

// Pulsing dot used in the scanner strip — a solid blue dot with a fading
// ring radiating out, looping forever. Falls back to a static dot when
// the user has reduced-motion preferences.
function PulseDot({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: 10, height: 10 }}>
      {active ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full ls-rep-pulse"
          style={{ backgroundColor: "#2563EB" }}
        />
      ) : null}
      <span
        className="relative inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: "#2563EB",
          boxShadow: "0 0 0 1.5px rgba(37, 99, 235, 0.18)",
        }}
      />
    </span>
  );
}

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
        className="mt-1 tabular-nums"
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
  children,
  status,
  muted,
  flashKey,
  activeFlash,
}: {
  source: string;
  rating: number | null;
  author: string;
  when: string;
  children: React.ReactNode;
  status: "needs-reply" | "watch" | "positive" | "reviewed";
  muted?: boolean;
  flashKey: SourceKey;
  activeFlash: SourceKey | null;
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
  const isFlashing = activeFlash === flashKey;

  return (
    <li
      // Re-key on every flash so the CSS animation actually re-runs
      // (a class change alone wouldn't restart the keyframe).
      key={isFlashing ? `${flashKey}-flash` : flashKey}
      className={`px-5 py-3.5 border-b last:border-b-0 ${
        isFlashing ? "ls-rep-flash" : ""
      }`}
      style={{
        borderColor: "#F1F5F9",
        opacity: muted ? 0.55 : 1,
        transition: "opacity 240ms ease",
      }}
    >
      <div className="flex items-start sm:items-baseline justify-between gap-2 sm:gap-3 mb-1.5 flex-wrap sm:flex-nowrap">
        <div
          className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap order-2 sm:order-1"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#94A3B8",
          }}
        >
          <SourceIcon source={source} />
          <span style={{ color: "#1E2A3A", fontWeight: 600 }}>{source}</span>
          {rating != null ? (
            <span style={{ color: "#2563EB" }}>{"★".repeat(rating)}</span>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{author}</span>
          <span aria-hidden="true">·</span>
          <span style={{ whiteSpace: "nowrap" }}>{when}</span>
          {isFlashing ? (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                fontWeight: 700,
                color: "#2563EB",
                backgroundColor: "rgba(37, 99, 235, 0.10)",
              }}
            >
              <span
                className="inline-block h-1 w-1 rounded-full"
                style={{ backgroundColor: "#2563EB" }}
                aria-hidden
              />
              Found
            </span>
          ) : null}
        </div>
        <span
          className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 order-1 sm:order-2"
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
        {children}
      </p>
    </li>
  );
}
