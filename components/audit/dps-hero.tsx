import { CountUp } from "@/components/audit/count-up";

// DPS hero — the centerpiece of the audit result page.
//
// Renders the post-cap Digital Performance Score with a conic-gradient
// ring, "/100" suffix, the "Why we capped this" copy, and a subtitle
// that names the brand. Color tone tracks the score band:
//   0-39   → red    (red ring, red number)
//   40-59  → amber  (amber)
//   60-74  → blue   (LeaseStack brand)
//   75     → green  (only at the cap ceiling)
//
// We accept score directly (not the full DpsResult) so the same hero
// can be reused for any "score with cap reason" surface. Adam 2026-06-01.

type Tone = "red" | "amber" | "blue" | "green";

function toneFor(score: number): Tone {
  if (score >= 75) return "green";
  if (score >= 60) return "blue";
  if (score >= 40) return "amber";
  return "red";
}

const TONE: Record<Tone, { ring: string; text: string; bg: string }> = {
  green: { ring: "#0E9F6E", text: "#0E9F6E", bg: "rgba(14,159,110,0.08)" },
  blue: { ring: "#2563EB", text: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  amber: { ring: "#B45309", text: "#B45309", bg: "rgba(180,83,9,0.08)" },
  red: { ring: "#B91C1C", text: "#B91C1C", bg: "rgba(185,28,28,0.08)" },
};

export function DpsHero({
  subject,
  score,
  cap,
  capReason,
  recommendationCount,
}: {
  subject: string;
  score: number;
  cap: number;
  capReason: string;
  recommendationCount: number;
}) {
  const tone = toneFor(score);
  const palette = TONE[tone];
  const arcDeg = Math.max(0, Math.min(score, 100)) * 3.6;

  return (
    <section className="mt-10">
      <div
        className="rounded-2xl border p-8 sm:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="flex-1">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#6B7280", fontFamily: "var(--font-mono)" }}
          >
            Digital Performance Score
          </p>
          <div className="flex items-baseline gap-3 mt-2">
            <CountUp
              to={score}
              className="text-7xl sm:text-8xl font-semibold tabular-nums leading-none"
            />
            <span className="text-2xl" style={{ color: "#9CA3AF" }}>
              / 100
            </span>
            <span
              className="ml-2 text-xs font-medium px-2 py-0.5 rounded-md"
              style={{ color: palette.text, backgroundColor: palette.bg }}
            >
              Ceiling: {cap}
            </span>
          </div>
          <p
            className="mt-4 text-base max-w-xl leading-relaxed"
            style={{ color: "#4B5563" }}
          >
            How {subject} performs across the six pillars every modern property
            is judged on — findability, reputation, conversion, tracking,
            accessibility, and listings.
          </p>
          <div
            className="mt-4 rounded-lg border-l-2 pl-3 py-1"
            style={{ borderColor: palette.ring }}
          >
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-1"
              style={{ color: palette.text, fontFamily: "var(--font-mono)" }}
            >
              Why your ceiling is {cap}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>
              {capReason}
            </p>
          </div>
          {recommendationCount > 0 ? (
            <p
              className="mt-4 text-sm font-medium"
              style={{ color: "#1E2A3A" }}
            >
              {recommendationCount} personalized action item
              {recommendationCount === 1 ? "" : "s"} below.
            </p>
          ) : null}
        </div>
        <div
          className="h-32 w-32 sm:h-40 sm:w-40 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `conic-gradient(${palette.ring} ${arcDeg}deg, #F3F4F6 0deg)`,
          }}
          aria-hidden
        >
          <div
            className="h-24 w-24 sm:h-32 sm:w-32 rounded-full flex flex-col items-center justify-center"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <span
              className="text-3xl sm:text-4xl font-semibold leading-none"
              style={{ color: palette.text }}
            >
              {score}
            </span>
            <span
              className="text-[10px] font-mono uppercase tracking-[0.14em] mt-1"
              style={{ color: "#9CA3AF", fontFamily: "var(--font-mono)" }}
            >
              of {cap} cap
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
