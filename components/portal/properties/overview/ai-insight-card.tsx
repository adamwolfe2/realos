import { Sparkles } from "lucide-react";
import type { AiInsightShape, InsightSeverity } from "./types";

// ---------------------------------------------------------------------------
// AI insight — fallback only. Used when the detector library hasn't run yet.
// ---------------------------------------------------------------------------

export function buildAiInsight(args: {
  occupancyPct: number | null;
  leasedUnits: number | null;
  totalUnits: number | null;
  availableUnits: number;
  leads28d: number;
  leadsPrev28d: number;
  tours28d: number;
  applications28d: number;
  expiringNext30: number;
  expiringNext60: number;
  noticeGiven: number;
  propertyName: string;
}): AiInsightShape {
  const candidates: AiInsightShape[] = [];

  if (
    args.occupancyPct != null &&
    args.occupancyPct < 80 &&
    args.availableUnits > 0
  ) {
    candidates.push({
      severity: "alert",
      headline: `Occupancy at ${args.occupancyPct}%. ${args.availableUnits} units sitting.`,
      body: `${args.propertyName} is below the 90% target. Push paid spend here, accelerate scheduled tours, and check listing photos on Available units.`,
    });
  }
  if (args.expiringNext30 >= 5) {
    candidates.push({
      severity: "alert",
      headline: `${args.expiringNext30} leases expire in 30 days`,
      body: `Renewal offers should already be out. Run the renewals report and confirm every resident has been contacted.`,
    });
  }
  if (
    args.leadsPrev28d > 5 &&
    args.leads28d < Math.round(args.leadsPrev28d * 0.6)
  ) {
    const dropPct = Math.round(
      (1 - args.leads28d / args.leadsPrev28d) * 100,
    );
    candidates.push({
      severity: "warn",
      headline: `Lead volume down ${dropPct}% week-over-week`,
      body: `Check ad spend pacing and chatbot capture rate. ${args.leadsPrev28d} leads previous window vs ${args.leads28d} now.`,
    });
  }
  if (args.leads28d >= 10 && args.tours28d === 0) {
    candidates.push({
      severity: "warn",
      headline: `${args.leads28d} leads, zero tours scheduled`,
      body: `Leads aren't converting to scheduled tours. Audit chatbot prompts and lead-response speed; the first reply window is decisive.`,
    });
  }
  if (args.tours28d >= 5 && args.applications28d === 0) {
    candidates.push({
      severity: "warn",
      headline: `${args.tours28d} tours, zero applications`,
      body: `Tours are happening but converting at 0%. Check pricing positioning and tour follow-up cadence.`,
    });
  }
  if (args.noticeGiven >= 5) {
    candidates.push({
      severity: "warn",
      headline: `${args.noticeGiven} residents have given notice`,
      body: `Predictive availability says these units come open soon. Get listings live now to bridge the gap.`,
    });
  }
  if (
    args.occupancyPct != null &&
    args.occupancyPct >= 95 &&
    args.expiringNext60 < 5
  ) {
    candidates.push({
      severity: "ok",
      headline: `Strong: ${args.occupancyPct}% occupied, low near-term churn`,
      body: `${args.propertyName} is performing well. Use the spare cycles to test rent increases on the next renewal cohort.`,
    });
  }

  if (candidates.length === 0) {
    return {
      severity: "info",
      headline: "Quiet on the data front",
      body: `Not enough signal yet to flag an action. Once leads, tours, and lease activity pick up, the model will surface what to do next.`,
    };
  }
  const order: Record<InsightSeverity, number> = {
    alert: 0,
    warn: 1,
    info: 2,
    ok: 3,
  };
  candidates.sort((a, b) => order[a.severity] - order[b.severity]);
  return candidates[0];
}

export function AiInsightCard({ insight }: { insight: AiInsightShape }) {
  const tone =
    insight.severity === "alert"
      ? "border-primary/40 bg-primary/10 text-primary"
      : insight.severity === "warn"
        ? "border-primary/25 bg-primary/5 text-foreground"
        : insight.severity === "ok"
          ? "border-primary/25 bg-primary/5 text-primary"
          : "border-border bg-muted/30 text-foreground";
  return (
    <div
      className={`rounded-xl border px-3 py-2 flex items-start gap-2.5 ${tone}`}
    >
      <Sparkles className="h-4 w-4 shrink-0 mt-0.5 opacity-80" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-tight leading-tight">
          {insight.headline}
        </p>
        <p className="text-[11px] mt-0.5 opacity-90 leading-snug">
          {insight.body}
        </p>
      </div>
    </div>
  );
}
