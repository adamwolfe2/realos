import { CountUp } from "@/components/audit/count-up";

// DPS hero — the centerpiece of the audit result page.
//
// Renders the Digital Performance Score with a conic-gradient ring, a
// "/100" suffix, and a one-line subtitle. Tone tracks the score band so
// a 47 reads visually different from an 81.
//
// Adam 2026-06-01: do NOT surface the cap/ceiling to the user. The
// caps are enforced server-side so scores naturally land low — the
// prospect should see the number, understand the gaps, and feel
// motivated to talk to us. Telling them "we capped you" defeats the
// effect.

type Tone = "red" | "amber" | "blue" | "green";

function toneFor(score: number): Tone {
  if (score >= 80) return "green";
  if (score >= 65) return "blue";
  if (score >= 45) return "amber";
  return "red";
}

const TONE: Record<Tone, { ring: string; text: string; bg: string }> = {
  green: { ring: "#0E9F6E", text: "#0E9F6E", bg: "rgba(14,159,110,0.08)" },
  blue: { ring: "#2563EB", text: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  amber: { ring: "#B45309", text: "#B45309", bg: "rgba(180,83,9,0.08)" },
  red: { ring: "#B91C1C", text: "#B91C1C", bg: "rgba(185,28,28,0.08)" },
};

function tonalHeadline(score: number): string {
  if (score >= 80) return "Real fundamentals in place";
  if (score >= 65) return "Solid baseline, real upside to chase";
  if (score >= 45) return "Meaningful gaps holding leases back";
  return "Critical exposure across the funnel";
}

export function DpsHero({
  subject,
  score,
  recommendationCount,
}: {
  subject: string;
  /** Post-scoring number 0-100. Caps are applied upstream; this
   *  component does not surface that they exist. */
  score: number;
  recommendationCount: number;
}) {
  const tone = toneFor(score);
  const palette = TONE[tone];
  const arcDeg = Math.max(0, Math.min(score, 100)) * 3.6;
  const headline = tonalHeadline(score);

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
              style={{ color: palette.text }}
            />
            <span className="text-2xl" style={{ color: "#9CA3AF" }}>
              / 100
            </span>
          </div>
          <p
            className="mt-3 text-base sm:text-lg font-semibold"
            style={{ color: palette.text }}
          >
            {headline}
          </p>
          <p
            className="mt-3 text-base max-w-xl leading-relaxed"
            style={{ color: "#4B5563" }}
          >
            How {subject} performs across the six pillars every modern property
            is judged on — findability, reputation, conversion, tracking,
            accessibility, and listings.
          </p>
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
            className="h-24 w-24 sm:h-32 sm:w-32 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <span
              className="text-3xl sm:text-4xl font-semibold leading-none"
              style={{ color: palette.text }}
            >
              {score}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
