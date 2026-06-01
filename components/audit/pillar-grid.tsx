import type { ReactNode } from "react";
import {
  Search,
  Star,
  ArrowDownToLine,
  LineChart,
  Gauge,
  Building2,
} from "lucide-react";
import { ScoreCard } from "@/components/audit/score-card";
import { PILLAR_LABELS, type Pillar } from "@/lib/audit/quiz-questions";
import type { PillarScore } from "@/lib/audit/scoring";

// Per-pillar Lucide icons. Picked to match each pillar's mental model
// — Search = findability, Star = reputation, ArrowDownToLine =
// conversion funnel, LineChart = tracking/attribution, Gauge = speed,
// Building2 = listing presence. Renders next to the pillar title in
// the same accent color as the score ring.
const PILLAR_ICON: Record<Pillar, ReactNode> = {
  findability: <Search className="h-3.5 w-3.5" strokeWidth={1.75} />,
  reputation: <Star className="h-3.5 w-3.5" strokeWidth={1.75} />,
  conversion: <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.75} />,
  tracking: <LineChart className="h-3.5 w-3.5" strokeWidth={1.75} />,
  accessibility: <Gauge className="h-3.5 w-3.5" strokeWidth={1.75} />,
  listings: <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
};

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
              icon={PILLAR_ICON[key]}
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
