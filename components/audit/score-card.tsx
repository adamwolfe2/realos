import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tonal palette used across the audit viewer. Matches the marketing
// brand-blue (`#2563EB`) for the primary tone so all score rings share
// a single accent with the rest of the site.
type Tone = "green" | "blue" | "amber" | "red";

export function toneForScore(score: number | null | undefined): Tone {
  const s = score ?? 0;
  if (s >= 80) return "green";
  if (s >= 60) return "blue";
  if (s >= 40) return "amber";
  return "red";
}

const TONE: Record<Tone, { ring: string; text: string; bg: string }> = {
  green: { ring: "#0E9F6E", text: "#0E9F6E", bg: "rgba(14,159,110,0.08)" },
  blue: { ring: "#2563EB", text: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  amber: { ring: "#B45309", text: "#B45309", bg: "rgba(180,83,9,0.08)" },
  red: { ring: "#B91C1C", text: "#B91C1C", bg: "rgba(185,28,28,0.08)" },
};

export function ScoreCard({
  title,
  score,
  delta,
  caption,
  reasoning,
  icon,
  className,
}: {
  title: string;
  score: number | null | undefined;
  delta?: number | null;
  caption?: string;
  /** "Why this score" — short bullet list rendered under the score so
   *  the prospect understands what's driving the number. Empty array
   *  or undefined → reasoning section hides. Adam 2026-05-29. */
  reasoning?: { headline?: string | null; points: string[] } | null;
  /** Optional pillar glyph rendered next to the title. */
  icon?: ReactNode;
  className?: string;
}) {
  // Adam 2026-05-29: previously `score ?? 0` collapsed null/undefined
  // into a real "0" displayed as 0/100 with a red ring — making provider
  // failures look identical to genuinely-zero scores. Now an explicit
  // null/undefined renders an "Awaiting data" placeholder card with the
  // neutral palette and an empty progress track. Genuinely-zero scores
  // still display 0 in red.
  const hasScore =
    typeof score === "number" && Number.isFinite(score);
  const value = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  const tone = toneForScore(value);
  // Unavailable state borrows the muted palette so it's visually
  // distinguishable from a real low score (no red ring).
  const palette = hasScore ? TONE[tone] : MUTED_PALETTE;
  const pct = hasScore ? value : 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 flex flex-col gap-2",
        className,
      )}
      style={{ borderColor: "#E5E7EB" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em] flex items-center gap-1.5"
            style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
          >
            {icon ? (
              <span
                aria-hidden
                className="inline-flex items-center justify-center"
                style={{ color: palette.ring }}
              >
                {icon}
              </span>
            ) : null}
            <span>{title}</span>
          </p>
          {caption ? (
            <p className="text-sm mt-1" style={{ color: "#4B5563" }}>
              {caption}
            </p>
          ) : null}
        </div>
        {typeof delta === "number" && Number.isFinite(delta) && hasScore ? (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-md"
            style={{ color: palette.text, backgroundColor: palette.bg }}
          >
            {delta >= 0 ? "+" : ""}
            {Math.round(delta * 10) / 10}
          </span>
        ) : null}
      </div>
      {hasScore ? (
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-3xl font-semibold tabular-nums leading-none"
            style={{ color: palette.text }}
          >
            {value}
          </span>
          <span className="text-xs" style={{ color: "#9CA3AF" }}>
            / 100
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span
            className="text-sm font-medium"
            style={{ color: "#6B7280" }}
            title="Provider data isn't available yet for this property — the score will populate after the next scan."
          >
            Awaiting data
          </span>
          <span
            className="text-[11px]"
            style={{ color: "#9CA3AF" }}
          >
            Scan still expanding coverage
          </span>
        </div>
      )}
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            backgroundColor: palette.ring,
            transition: "width 600ms ease-out",
          }}
        />
      </div>
      {reasoning && (reasoning.headline || reasoning.points.length > 0) ? (
        <div className="mt-2 pt-3 border-t" style={{ borderColor: "#F3F4F6" }}>
          {reasoning.headline ? (
            <p
              className="text-xs font-semibold mb-1.5"
              style={{ color: "#1E2A3A" }}
            >
              {reasoning.headline}
            </p>
          ) : null}
          {reasoning.points.length > 0 ? (
            <ul className="space-y-1">
              {reasoning.points.map((point, i) => (
                <li
                  key={i}
                  className="text-[11.5px] leading-snug flex items-start gap-1.5"
                  style={{ color: "#6B7280" }}
                >
                  <span
                    aria-hidden
                    className="inline-block flex-shrink-0 mt-1"
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: "#9CA3AF",
                    }}
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Neutral palette used when a section has no provider data — keeps the
// card from reading as a "real bad score" (red ring at 0).
const MUTED_PALETTE = {
  ring: "#CBD5E1",
  text: "#6B7280",
  bg: "rgba(148,163,184,0.08)",
};
