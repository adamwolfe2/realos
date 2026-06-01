import { ScoreCard } from "@/components/audit/score-card";
import { PILLAR_LABELS, type Pillar } from "@/lib/audit/quiz-questions";
import type { PillarScore } from "@/lib/audit/scoring";

// PillarGrid — six pillar sub-scores beneath the DPS hero.
//
// Each card reads as a real, honest score. We deliberately do NOT
// surface the per-pillar cap or the capReason — those are enforcement
// mechanics, not customer-facing copy. The reasoning bullets we DO
// surface are the supporting points (real numbers from the scan, real
// quiz answers) — they explain why the score is what it is without
// telegraphing that the score has a ceiling. Adam 2026-06-01.

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
        Real data behind every number — pulled from your quiz answers
        and the live scan we just ran on your domain.
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PILLAR_ORDER.map((key) => {
          const p = pillars[key];
          return (
            <ScoreCard
              key={key}
              title={PILLAR_LABELS[key]}
              score={p.score}
              reasoning={{
                headline: p.headline,
                points: p.points,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
