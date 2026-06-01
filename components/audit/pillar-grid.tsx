import { ScoreCard } from "@/components/audit/score-card";
import { PILLAR_LABELS, type Pillar } from "@/lib/audit/quiz-questions";
import type { PillarScore } from "@/lib/audit/scoring";

// PillarGrid — renders the six pillar sub-scores beneath the DPS hero.
//
// Reuses the existing ScoreCard primitive (which already handles tone,
// progress bar, and reasoning bullets). The cap-aware "ceiling at X"
// chip is rendered as the caption so operators see "this is the
// ceiling, not your real score" up-front.

const PILLAR_ORDER: Pillar[] = [
  "findability",
  "reputation",
  "conversion",
  "tracking",
  "accessibility",
  "listings",
];

export function PillarGrid({
  pillars,
}: {
  pillars: Record<Pillar, PillarScore>;
}) {
  return (
    <section className="mt-8">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        The six pillars
      </p>
      <h2
        className="text-2xl sm:text-3xl font-semibold mt-2"
        style={{ color: "#1E2A3A" }}
      >
        What's driving your score
      </h2>
      <p className="text-sm mt-2 max-w-2xl" style={{ color: "#6B7280" }}>
        Each pillar has its own ceiling — the score you see is what's
        possible without LeaseStack closing the structural gaps. Tap any
        card for the supporting numbers.
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PILLAR_ORDER.map((key) => {
          const p = pillars[key];
          return (
            <ScoreCard
              key={key}
              title={PILLAR_LABELS[key]}
              score={p.score}
              caption={`Ceiling: ${p.cap}`}
              reasoning={{
                headline: p.headline,
                points: p.capReason
                  ? [p.capReason, ...p.points]
                  : p.points,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
