"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// ScanProgress — the shared "scan is running" theater: pulsing dot, rotating
// status line, indeterminate bar, and a receding step history. Extracted from
// the digital-score-quiz (the best waiting experience in the product) so the
// AI-visibility and reputation-report forms stop shipping a bare spinner for
// the exact same underlying scan.
//
// Keyframes live in globals.css (ls-scan-*) rather than styled-jsx so the
// global prefers-reduced-motion net covers them.
// ---------------------------------------------------------------------------

export function ScanProgress({
  messages,
  intervalMs = 2400,
  advance = "loop",
  heading,
  footer,
  showStepHistory = true,
}: {
  /** Rotating status lines, shown in order. */
  messages: readonly string[];
  intervalMs?: number;
  /** "loop" cycles forever (unknown-length waits); "hold" stops on the
   *  last message (scripted sequences). */
  advance?: "loop" | "hold";
  /** Optional bold line above the status theater. */
  heading?: React.ReactNode;
  /** Optional note under the divider (domain being scanned, email copy). */
  footer?: React.ReactNode;
  showStepHistory?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => {
        if (advance === "hold" && i >= messages.length - 1) return i;
        return (i + 1) % messages.length;
      });
      setAnimKey((k) => k + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [advance, intervalMs, messages.length]);

  const current = messages[Math.min(index, messages.length - 1)];
  const history = useMemo(() => {
    const out: string[] = [];
    for (let back = 1; back <= 3; back++) {
      const i =
        advance === "hold"
          ? index - back
          : (index - back + messages.length) % messages.length;
      if (i < 0) break;
      out.push(messages[i]);
    }
    return out;
  }, [advance, index, messages]);

  return (
    <div
      className="rounded-xl border bg-white p-6"
      style={{ borderColor: "#E5E7EB" }}
    >
      {heading ? (
        <p
          className="mb-3 text-[15px] font-semibold"
          style={{ color: "#1E2A3A" }}
        >
          {heading}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#2563EB",
            animation: "ls-scan-dot 1.4s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <p
          className="text-sm font-medium"
          style={{ color: "#1E2A3A", minHeight: 20 }}
          aria-live="polite"
        >
          <span
            key={animKey}
            style={{
              display: "inline-block",
              animation: "ls-scan-fade 360ms ease-out",
            }}
          >
            {current}
          </span>
        </p>
      </div>

      <div
        className="mt-4 h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <div
          className="h-full"
          style={{
            width: "100%",
            backgroundColor: "#2563EB",
            animation: "ls-scan-bar 1.2s ease-in-out infinite",
            transformOrigin: "0% 50%",
          }}
        />
      </div>

      {showStepHistory && history.length > 0 ? (
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
                  animation: i === 0 ? "ls-scan-fade 420ms ease-out" : "none",
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
      ) : null}

      {footer ? (
        <p
          className="text-xs mt-4 pt-3 border-t"
          style={{ color: "#9CA3AF", borderColor: "#F3F4F6" }}
        >
          {footer}
        </p>
      ) : null}
    </div>
  );
}
