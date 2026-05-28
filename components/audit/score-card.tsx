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
  const value = Math.max(0, Math.min(100, score ?? 0));
  const tone = toneForScore(value);
  const palette = TONE[tone];
  const pct = value;

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
        {typeof delta === "number" && Number.isFinite(delta) ? (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-md"
            style={{ color: palette.text, backgroundColor: palette.bg }}
          >
            {delta >= 0 ? "+" : ""}
            {Math.round(delta * 10) / 10}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-4xl font-semibold tabular-nums"
          style={{ color: palette.text }}
        >
          {value}
        </span>
        <span
          className="text-sm"
          style={{ color: "#9CA3AF" }}
        >
          / 100
        </span>
      </div>
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
