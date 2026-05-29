"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Audit start form. Submits the URL to /api/audit/start, then polls
// /api/audit/[id] until status === READY (or FAILED), then redirects
// to /audit/[shareToken]. Polling interval is 2s; we cap polls at ~90s
// so a stuck QUEUED row eventually surfaces a retry instead of spinning
// forever.

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

// Rotating scan-status messages. Adam 2026-05-29: "we need ~20
// different ones because the scan takes over a minute." Ordered to
// mirror the actual backend pipeline order (SEO fan-out → AEO 4-engine
// fan-out → reputation per-source scan → synthesis) so the visible
// progression feels honest, not invented. Every message references a
// real thing computeSignals() is actually doing.
const SCAN_STATUS_MESSAGES: string[] = [
  // Phase 1: SEO / DataForSEO fan-out
  "Pulling ranked keywords from DataForSEO…",
  "Running a mobile Lighthouse audit on your homepage…",
  "Extracting page metadata and on-page checks…",
  "Counting backlinks and referring domains…",
  "Estimating organic search traffic from rank × CTR…",
  "Inspecting title tags, descriptions, and canonicals…",

  // Phase 2: AEO — 4 engines × prompts
  "Querying Claude about your property…",
  "Querying ChatGPT about your property…",
  "Querying Gemini about your property…",
  "Querying Perplexity about your property…",
  "Checking which AI engines cite your brand by name…",
  "Identifying competitors cited instead of you…",
  "Categorizing AI search queries by intent…",
  "Tracking Perplexity queries about your market…",

  // Phase 3: Reputation — per-source fan-out
  "Scanning Reddit for brand mentions…",
  "Sorting through Reddit comment threads…",
  "Searching Yelp for property reviews…",
  "Checking Google for review listings…",
  "Pulling ApartmentRatings.com mentions…",
  "Scanning BBB for complaint filings…",
  "Searching Facebook for review posts…",
  "Sorting through Facebook groups…",
  "Crawling open-web review sites…",
  "Ranking sites with brand mentions…",

  // Phase 4: Synthesis
  "Classifying mention sentiment with Claude Haiku…",
  "Computing your reputation score…",
  "Generating quick-win action items…",
  "Tracking competitors near your property…",
  "Writing your narrative summary…",
  "Finalizing your report…",
];

// Cadence — messages step every ~2.4s. The backend scan typically
// takes 30-60s, so the rotation cycles through ~12-25 messages before
// the redirect lands. Picked so a single message is on-screen long
// enough to read but not so long it feels stuck.
const SCAN_STATUS_INTERVAL_MS = 2400;

type Phase = "idle" | "starting" | "scanning" | "error";

interface StartResponse {
  auditId: string;
  shareToken: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  cached?: boolean;
}
interface StatusResponse {
  id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  overallScore: number | null;
  shareToken: string;
  domain: string;
  hasEmail: boolean;
}

export function AuditForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scannedDomain, setScannedDomain] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const redirect = useCallback(
    (token: string) => router.push(`/audit/${token}`),
    [router],
  );

  const startPolling = useCallback(
    (auditId: string, token: string, domain: string) => {
      setPhase("scanning");
      setScannedDomain(domain);
      const startedAt = Date.now();
      const poll = async () => {
        if (stoppedRef.current) return;
        try {
          const res = await fetch(`/api/audit/${auditId}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Status check failed");
          const data: StatusResponse = await res.json();
          if (data.status === "READY") {
            if (pollRef.current) clearInterval(pollRef.current);
            redirect(token);
            return;
          }
          if (data.status === "FAILED") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("The scan failed. Try again in a moment.");
            setPhase("error");
            return;
          }
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("Still working — open the report from this link.");
            setPhase("error");
          }
        } catch {
          // Transient — keep polling until timeout.
        }
      };
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
      void poll();
    },
    [redirect],
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url.trim() || phase !== "idle") return;
    setError(null);
    setPhase("starting");
    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: StartResponse | { error: string } = await res.json();
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : "Could not start audit";
        setError(msg);
        setPhase("error");
        return;
      }
      if (data.status === "READY") {
        redirect(data.shareToken);
        return;
      }
      startPolling(data.auditId, data.shareToken, normalizeUrlForDisplay(url));
    } catch {
      setError("Network error. Try again.");
      setPhase("error");
    }
  }

  if (phase === "scanning" || phase === "starting") {
    return (
      <ScanProgress scannedDomain={scannedDomain} />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={submit}
        className="rounded-xl border bg-white p-4 sm:p-5 flex flex-col sm:flex-row gap-3"
        style={{ borderColor: "#E5E7EB" }}
      >
        <Input
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="yourproperty.com"
          aria-label="Property website URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 h-11 text-base"
        />
        <Button type="submit" size="lg" disabled={!url.trim()}>
          Get my free audit
        </Button>
      </form>
      {error ? (
        <p className="text-sm px-1" style={{ color: "#B91C1C" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScanProgress — rotating-status loading state.
//
// Cycles through SCAN_STATUS_MESSAGES every SCAN_STATUS_INTERVAL_MS so
// the visitor sees a live feed of what the audit is doing. Each message
// fades in/out via opacity transition. A pulsing brand-blue dot next
// to the message reinforces "this is live" — the static progress bar
// from the previous version had no per-frame motion and made the wait
// feel longer than it actually was.
//
// We also surface a tiny scrolling log of the last 3 completed
// messages so the visitor sees breadth of work, not just a single
// claim that flips every 2.4s.
// ---------------------------------------------------------------------------
function ScanProgress({ scannedDomain }: { scannedDomain: string | null }) {
  const [index, setIndex] = useState(0);
  // Animation key — bumps every tick so React tears down + remounts
  // the message <span> and the opacity transition plays from 0 → 1
  // again. Without this the CSS transition only fires on mount.
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SCAN_STATUS_MESSAGES.length);
      setAnimKey((k) => k + 1);
    }, SCAN_STATUS_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const current = SCAN_STATUS_MESSAGES[index];
  // Last 3 completed messages — short rolling log under the active line.
  // Wraps around the array boundary so the log feels continuous.
  const history = [
    SCAN_STATUS_MESSAGES[
      (index - 1 + SCAN_STATUS_MESSAGES.length) % SCAN_STATUS_MESSAGES.length
    ],
    SCAN_STATUS_MESSAGES[
      (index - 2 + SCAN_STATUS_MESSAGES.length) % SCAN_STATUS_MESSAGES.length
    ],
    SCAN_STATUS_MESSAGES[
      (index - 3 + SCAN_STATUS_MESSAGES.length) % SCAN_STATUS_MESSAGES.length
    ],
  ];

  return (
    <div
      className="rounded-xl border bg-white p-6"
      style={{ borderColor: "#E5E7EB" }}
    >
      {/* Live-status row — pulsing dot + the rotating current message */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#2563EB",
            animation: "audit-pulse-dot 1.4s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <p
          className="text-sm font-medium"
          style={{ color: "#1E2A3A", minHeight: 20 }}
        >
          <span
            key={animKey}
            style={{
              display: "inline-block",
              animation: "audit-status-fade 360ms ease-out",
            }}
          >
            {current}
          </span>
        </p>
      </div>

      {/* Progress bar — kept from the previous version because the
          indeterminate animation reinforces "the bar is moving while
          the labels are rotating." Slightly shorter (1.2s instead of
          1.4s) so the visual cadence matches the message rotation. */}
      <div
        className="mt-4 h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <div
          className="h-full"
          style={{
            width: "100%",
            backgroundColor: "#2563EB",
            animation: "audit-progress-bar 1.2s ease-in-out infinite",
            transformOrigin: "0% 50%",
          }}
        />
      </div>

      {/* Rolling log — last 3 completed steps, faded so the rolling
          activity reads as a history feed rather than as 4 competing
          headlines. */}
      <div className="mt-4">
        <p
          className="text-[10px] font-mono uppercase tracking-[0.14em] mb-1.5"
          style={{ color: "#9CA3AF" }}
        >
          Recent steps
        </p>
        <ul className="space-y-1">
          {history.map((msg, i) => (
            <li
              key={`${msg}-${animKey}-${i}`}
              className="text-xs"
              style={{
                color: "#9CA3AF",
                opacity: 0.85 - i * 0.22,
                fontFamily: "var(--font-mono)",
                animation: i === 0 ? "audit-status-fade 420ms ease-out" : "none",
              }}
            >
              <span aria-hidden style={{ color: "#CBD5E1" }}>
                ✓
              </span>{" "}
              {msg}
            </li>
          ))}
        </ul>
      </div>

      <p
        className="text-xs mt-4 pt-3 border-t"
        style={{ color: "#9CA3AF", borderColor: "#F3F4F6" }}
      >
        Scanning {scannedDomain ?? "your site"} · usually 30-60 seconds
      </p>

      <style jsx>{`
        @keyframes audit-progress-bar {
          0% {
            transform: scaleX(0);
            opacity: 0.4;
          }
          50% {
            transform: scaleX(0.75);
            opacity: 1;
          }
          100% {
            transform: scaleX(1);
            opacity: 0.4;
          }
        }
        @keyframes audit-pulse-dot {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.55;
          }
        }
        @keyframes audit-status-fade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function normalizeUrlForDisplay(input: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const u = new URL(withScheme);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}
