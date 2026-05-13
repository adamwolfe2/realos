import "server-only";
import { prisma } from "@/lib/db";
import { trafficDropDetector } from "./detectors/traffic-drop";
import { pipelineStallDetector } from "./detectors/pipeline-stall";
import { cplSpikeDetector } from "./detectors/cpl-spike";
import { hotVisitorDetector } from "./detectors/hot-visitor";
import { chatbotPatternDetector } from "./detectors/chatbot-pattern";
import { convRateDropDetector } from "./detectors/conv-rate-drop";
import { leasingVelocityDropDetector } from "./detectors/leasing-velocity-drop";
import { negativeReviewDetector } from "./detectors/negative-review";
import { wastedAdSpendDetector } from "./detectors/wasted-ad-spend";
import { renewalCliffDetector } from "./detectors/renewal-cliff";
import { vacancyNeedsBoostDetector } from "./detectors/vacancy-needs-boost";
import { portfolioOutlierDetector } from "./detectors/portfolio-outlier";
import { upsertInsights, autoResolveStale } from "./upsert";
import { polishInsights } from "./llm-polish";
import type { Detector, DetectorResult } from "./types";

const DETECTORS: Detector[] = [
  trafficDropDetector,
  pipelineStallDetector,
  cplSpikeDetector,
  hotVisitorDetector,
  chatbotPatternDetector,
  convRateDropDetector,
  leasingVelocityDropDetector,
  // New (May 2026): high-leverage detectors that fire as soon as the
  // user connects their first data source. Reputation, ad-waste, renewal
  // cliffs, vacancy + portfolio benchmarking — the moat.
  negativeReviewDetector,
  wastedAdSpendDetector,
  renewalCliffDetector,
  vacancyNeedsBoostDetector,
  portfolioOutlierDetector,
];

// Detectors that produce one-insight-per-entity need their stale siblings
// auto-resolved. Time-keyed detectors (traffic-drop, cpl-spike, wasted-ad-
// spend) self-resolve when a new week's key appears.
const AUTORESOLVE_KINDS: Record<string, string[]> = {
  "pipeline-stall": ["pipeline_stall"],
  "hot-visitor": ["hot_visitor"],
  "leasing-velocity-drop": ["leasing_velocity_drop"],
  // Negative reviews stay open until the operator acts on them — no
  // auto-resolve. The mention id is the dedupeKey, so re-runs upsert
  // the same row instead of duplicating.
  "renewal-cliff": ["renewal_cliff"],
  "vacancy-needs-boost": ["vacancy_needs_boost"],
  "portfolio-outlier": ["portfolio_outlier"],
};

export interface InsightsRunSummary {
  orgId: string;
  totalDetected: number;
  totalInserted: number;
  totalUpdated: number;
  totalResolved: number;
  detectorResults: DetectorResult[];
}

export async function runInsightDetectors(
  orgId: string,
): Promise<InsightsRunSummary> {
  const summary: InsightsRunSummary = {
    orgId,
    totalDetected: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalResolved: 0,
    detectorResults: [],
  };

  // Phase 1: run every detector and collect raw insights. We DON'T
  // polish per-detector; one batched Claude call across the full pass
  // is dramatically cheaper than 12 separate ones.
  const allDetected: Array<{
    detector: string;
    insights: Awaited<ReturnType<Detector["run"]>>;
  }> = [];

  for (const detector of DETECTORS) {
    try {
      const detected = await detector.run(orgId);
      allDetected.push({ detector: detector.name, insights: detected });
      summary.totalDetected += detected.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.detectorResults.push({
        detector: detector.name,
        insights: [],
        error: message,
      });
    }
  }

  // Phase 2: polish every detected insight via Claude Haiku in ONE
  // batched call. Falls back to raw rule copy when no API key or on
  // any failure (see lib/insights/llm-polish.ts). Cost: ~$0.005 per
  // run regardless of org size.
  const flat = allDetected.flatMap((d) => d.insights);
  const polished =
    flat.length > 0 ? await polishInsights(flat) : flat;

  // Phase 3: upsert polished insights per detector (so detector
  // attribution + autoResolve still work correctly per detector).
  let polishedCursor = 0;
  for (const { detector, insights: detected } of allDetected) {
    const polishedSlice = polished.slice(
      polishedCursor,
      polishedCursor + detected.length,
    );
    polishedCursor += detected.length;

    summary.detectorResults.push({
      detector,
      insights: polishedSlice,
    });

    if (polishedSlice.length > 0) {
      const { inserted, updated } = await upsertInsights(
        orgId,
        polishedSlice,
      );
      summary.totalInserted += inserted;
      summary.totalUpdated += updated;
    }

    const kindsToResolve = AUTORESOLVE_KINDS[detector];
    if (kindsToResolve) {
      const keys = new Set(polishedSlice.map((d) => d.dedupeKey));
      const resolved = await autoResolveStale(orgId, kindsToResolve, keys);
      summary.totalResolved += resolved;
    }
  }

  return summary;
}

export async function runInsightDetectorsForAll(): Promise<InsightsRunSummary[]> {
  const orgs = await prisma.organization.findMany({
    where: {
      status: { in: ["LAUNCHED", "ACTIVE", "AT_RISK"] },
      orgType: "CLIENT",
    },
    select: { id: true },
  });

  return Promise.all(orgs.map((org) => runInsightDetectors(org.id)));
}
