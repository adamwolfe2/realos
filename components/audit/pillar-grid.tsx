import { ScoreCard } from "@/components/audit/score-card";
import { PILLAR_LABELS, type Pillar } from "@/lib/audit/quiz-questions";
import type { PillarScore } from "@/lib/audit/scoring";

// PillarGrid. Six pillar sub-scores beneath the DPS hero.
//
// Each card reads as a real, honest score. We deliberately do NOT
// surface the per-pillar cap or the capReason. Those are enforcement
// mechanics, not customer-facing copy. The reasoning bullets we DO
// surface are the supporting points (real numbers from the scan, real
// quiz answers). They explain why the score is what it is without
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
    <section className="mt-6">
      <p
        className="text-[10px] font-mono uppercase tracking-[0.16em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        The six pillars
      </p>
      <h2
        className="text-lg sm:text-xl font-semibold mt-1"
        style={{ color: "#1E2A3A" }}
      >
        What's driving your score
      </h2>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PILLAR_ORDER.map((key) => {
          const p = pillars[key];
          // Cap supporting points at 2. The pillar card should glance,
          // not punch-list. Adam 2026-06-01: tighter everywhere.
          return (
            <ScoreCard
              key={key}
              title={PILLAR_LABELS[key]}
              score={p.score}
              reasoning={{
                headline: p.headline,
                points: p.points.slice(0, 2),
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
