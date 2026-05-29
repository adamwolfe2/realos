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
  className,
}: {
  title: string;
  score: number | null | undefined;
  delta?: number | null;
  caption?: string;
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
        "rounded-xl border bg-white p-5 flex flex-col gap-3",
        className,
      )}
      style={{ borderColor: "#E5E7EB" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
          >
            {title}
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
        <div className="flex items-baseline gap-2">
          <span
            className="text-4xl font-semibold tabular-nums"
            style={{ color: palette.text }}
          >
            {value}
          </span>
          <span className="text-sm" style={{ color: "#9CA3AF" }}>
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
