import type { LeadSource, LeadStatus } from "@prisma/client";

// Source → stage flow for the "where leads come from" chart. A lead counts
// at every stage it has reached, so a SIGNED lead also counts as toured and
// applied. LOST/UNQUALIFIED leads only count as leads: status alone does not
// record how far they got before dropping out.

export const FLOW_STAGES = ["Leads", "Toured", "Applied", "Signed"] as const;

const REACHED: Record<LeadStatus, number> = {
  NEW: 0,
  CONTACTED: 0,
  TOUR_SCHEDULED: 0,
  LOST: 0,
  UNQUALIFIED: 0,
  TOURED: 1,
  APPLICATION_SENT: 1,
  APPLIED: 2,
  APPROVED: 2,
  SIGNED: 3,
};

export type SourceFlowRow = {
  source: LeadSource;
  /** Count per stage, aligned with FLOW_STAGES. */
  counts: number[];
};

export function buildSourceFlow(
  groups: Array<{ source: LeadSource; status: LeadStatus; count: number }>,
): { rows: SourceFlowRow[]; totals: number[] } {
  const bySource = new Map<LeadSource, number[]>();
  for (const g of groups) {
    const counts = bySource.get(g.source) ?? FLOW_STAGES.map(() => 0);
    for (let stage = 0; stage <= REACHED[g.status]; stage++) counts[stage] += g.count;
    bySource.set(g.source, counts);
  }
  const rows = [...bySource.entries()]
    .map(([source, counts]) => ({ source, counts }))
    .filter((r) => r.counts[0] > 0)
    .sort((a, b) => b.counts[0] - a.counts[0]);
  const totals = FLOW_STAGES.map((_, i) => rows.reduce((sum, r) => sum + r.counts[i], 0));
  return { rows, totals };
}
