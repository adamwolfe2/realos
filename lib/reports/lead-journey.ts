import "server-only";
import { prisma } from "@/lib/db";
import { ApplicationStatus, LeadStatus, TourStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Lead journey — follow one cohort of leads all the way through:
// Lead → Tour booked → Toured → Applied → Approved → Signed, cut by source.
//
// Cohort semantics: every stage counts leads CREATED in the window that have
// reached at least that stage (by their current state), so step-down
// conversion is a real ratio over one population — unlike the portfolio
// funnel, whose stages are independent cohorts.
//
// Stage sourcing follows the Norman-bug fix in lib/reports/generate.ts:1306 —
// Lead.status anchors the operator-driven transitions, and the AppFolio
// mirror tables (Application, Lease via Resident.leadId) layer on the stages
// nothing in prod code writes to Lead.status (APPLIED / APPROVED). Here the
// layering is a single OR on the Lead where-clause, so a lead counted via
// status AND via its Application row can never double count.
//
// Honesty rules (2026-07-29 spec):
// - An unconnected stage is `tracked: false`, never 0. Tours are untracked
//   until Cal.com (or another tour write path) produces a Tour row — the
//   AppFolio `showings` report 404s on this plan.
// - Conversion out of / into an untracked stage is undefined; the UI shows
//   an em-dash. `conversionFromPrev` is computed against the nearest
//   PREVIOUS TRACKED stage so Applied still gets a real % when tours are
//   dark.
// ---------------------------------------------------------------------------

export const JOURNEY_STAGES = [
  { key: "leads", label: "Leads" },
  { key: "tour_booked", label: "Tour booked" },
  { key: "toured", label: "Toured" },
  { key: "applied", label: "Applied" },
  { key: "approved", label: "Approved" },
  { key: "signed", label: "Signed" },
] as const;

export type JourneyStageKey = (typeof JOURNEY_STAGES)[number]["key"];

export type JourneyStage = {
  key: JourneyStageKey;
  label: string;
  count: number;
  tracked: boolean;
  /** % of the nearest previous TRACKED stage. Undefined for the first stage
   *  or when this stage (or every stage before it) is untracked. */
  conversionFromPrev?: number;
};

export type LeadJourney = {
  periodDays: number;
  stages: JourneyStage[];
  /** Per-source rows, same stage order as `stages`. */
  bySource: Array<{ source: string; counts: number[] }>;
  /** Off-ramps within the cohort — context, not funnel stages. */
  lost: number;
  unqualified: number;
};

export async function getLeadJourney(params: {
  orgId: string;
  /** null = org-wide; array = restrict to these properties. */
  propertyIds: string[] | null;
  periodDays?: number;
}): Promise<LeadJourney> {
  const periodDays = params.periodDays ?? 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const { orgId, propertyIds } = params;

  const cohort: Prisma.LeadWhereInput = {
    orgId,
    createdAt: { gte: since },
    ...(propertyIds !== null ? { propertyId: { in: propertyIds } } : {}),
  };

  // "Reached at least this stage" per stage. Status ranks alone under-count
  // (a lead can jump NEW → APPLIED without touring), so each stage ORs the
  // statuses that imply it with the mirror-table evidence for it.
  const stageWhere: Record<Exclude<JourneyStageKey, "leads">, Prisma.LeadWhereInput> = {
    tour_booked: {
      OR: [
        { status: { in: [LeadStatus.TOUR_SCHEDULED, LeadStatus.TOURED] } },
        { tours: { some: { status: { not: TourStatus.CANCELLED } } } },
      ],
    },
    toured: {
      OR: [
        { status: LeadStatus.TOURED },
        { tours: { some: { status: TourStatus.COMPLETED } } },
      ],
    },
    applied: {
      OR: [
        { status: { in: [LeadStatus.APPLIED, LeadStatus.APPROVED, LeadStatus.SIGNED] } },
        {
          applications: {
            some: {
              status: {
                in: [
                  ApplicationStatus.SUBMITTED,
                  ApplicationStatus.UNDER_REVIEW,
                  ApplicationStatus.APPROVED,
                  ApplicationStatus.DENIED,
                ],
              },
            },
          },
        },
      ],
    },
    approved: {
      OR: [
        { status: { in: [LeadStatus.APPROVED, LeadStatus.SIGNED] } },
        { applications: { some: { status: ApplicationStatus.APPROVED } } },
      ],
    },
    signed: {
      OR: [
        { status: LeadStatus.SIGNED },
        { residents: { some: { leases: { some: {} } } } },
      ],
    },
  };

  const groupBySource = (where: Prisma.LeadWhereInput) =>
    prisma.lead.groupBy({
      by: ["source"],
      where: { ...cohort, AND: [where] },
      _count: { _all: true },
    });

  const [
    leadRows,
    tourBookedRows,
    touredRows,
    appliedRows,
    approvedRows,
    signedRows,
    tourEvidence,
    lost,
    unqualified,
  ] = await Promise.all([
    groupBySource({}),
    groupBySource(stageWhere.tour_booked),
    groupBySource(stageWhere.toured),
    groupBySource(stageWhere.applied),
    groupBySource(stageWhere.approved),
    groupBySource(stageWhere.signed),
    // Tours are tracked only once the org has ANY tour evidence, ever —
    // all-time on purpose: an empty window on a connected pipe is a real 0.
    prisma.tour.count({ where: { lead: { orgId } }, take: 1 }),
    prisma.lead.count({ where: { ...cohort, status: LeadStatus.LOST } }),
    prisma.lead.count({ where: { ...cohort, status: LeadStatus.UNQUALIFIED } }),
  ]);

  const toursTracked = tourEvidence > 0;
  const trackedByKey: Record<JourneyStageKey, boolean> = {
    leads: true,
    tour_booked: toursTracked,
    toured: toursTracked,
    applied: true,
    approved: true,
    signed: true,
  };

  type SourceRow = Array<{ source: string; _count: { _all: number } }>;
  const toMap = (rows: SourceRow) =>
    new Map(rows.map((r) => [r.source as string, r._count._all]));
  const stageMaps = [
    toMap(leadRows),
    toMap(tourBookedRows),
    toMap(touredRows),
    toMap(appliedRows),
    toMap(approvedRows),
    toMap(signedRows),
  ];

  const totals = stageMaps.map((m) =>
    [...m.values()].reduce((s, n) => s + n, 0),
  );

  const stages: JourneyStage[] = JOURNEY_STAGES.map((def, i) => {
    const tracked = trackedByKey[def.key];
    // Nearest previous tracked stage for a meaningful step-down %.
    let prev: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (trackedByKey[JOURNEY_STAGES[j].key]) {
        prev = totals[j];
        break;
      }
    }
    const conversionFromPrev =
      tracked && prev != null && prev > 0
        ? Math.min(100, Math.round((totals[i] / prev) * 100))
        : undefined;
    return { key: def.key, label: def.label, count: totals[i], tracked, conversionFromPrev };
  });

  // Per-source rows, ordered by cohort size.
  const bySource = [...stageMaps[0].keys()]
    .map((source) => ({
      source,
      counts: stageMaps.map((m) => m.get(source) ?? 0),
    }))
    .sort((a, b) => b.counts[0] - a.counts[0]);

  return { periodDays, stages, bySource, lost, unqualified };
}
