import "server-only";
import { prisma } from "@/lib/db";
import type { ReportKind } from "@/lib/reports/generate";

// ---------------------------------------------------------------------------
// Which scheduled report drafts a cron run still owes.
//
// Each (org, property) pair is its own unit:
//   - every org gets the org-wide draft (propertyId null), as before
//   - an org with 2+ ACTIVE properties ALSO gets one draft per ACTIVE
//     property, so each building has its own report
//   - an org with 0 or 1 ACTIVE property gets only the org-wide draft (with
//     one building the org-wide report already IS that building's report)
//
// Dedup key = (orgId, propertyId) over cron-created rows (generatedBy null)
// in the period window, so a re-run never duplicates a draft and one
// property's draft never suppresses another's or the org-wide one.
//
// Order: stalest first (oldest previous cron draft for that unit; never
// drafted = stalest), so when the time budget runs out the units left for
// the catch-up run are the ones most recently refreshed.
// ---------------------------------------------------------------------------

export type ScheduledReportUnit = {
  orgId: string;
  propertyId: string | null;
};

export function unitKey(u: ScheduledReportUnit): string {
  return `${u.orgId}:${u.propertyId ?? "org"}`;
}

export async function planScheduledReportUnits(params: {
  kind: ReportKind;
  orgIds: string[];
  periodStart: Date;
  dedupWindowMs: number;
}): Promise<{ due: ScheduledReportUnit[]; alreadyDrafted: number }> {
  const { kind, orgIds, periodStart, dedupWindowMs } = params;
  if (orgIds.length === 0) return { due: [], alreadyDrafted: 0 };

  const [activeProperties, existing, lastDrafts] = await Promise.all([
    prisma.property.findMany({
      where: { orgId: { in: orgIds }, lifecycle: "ACTIVE" },
      select: { id: true, orgId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.clientReport.findMany({
      where: {
        orgId: { in: orgIds },
        kind,
        // Window, not exact match: periodStart = runNow - period to the
        // millisecond, so the catch-up run 2h later (vercel.json) or a
        // manual re-run would otherwise miss the first run's rows.
        // Only rows a cron creates: a manual report in the window must not
        // suppress the scheduled one.
        generatedBy: null,
        periodStart: {
          gte: new Date(periodStart.getTime() - dedupWindowMs),
          lte: periodStart,
        },
      },
      select: { orgId: true, propertyId: true },
    }),
    prisma.clientReport.groupBy({
      by: ["orgId", "propertyId"],
      where: { orgId: { in: orgIds }, kind, generatedBy: null },
      _max: { generatedAt: true },
    }),
  ]);

  const propertiesByOrg = new Map<string, string[]>();
  for (const p of activeProperties) {
    propertiesByOrg.set(p.orgId, [...(propertiesByOrg.get(p.orgId) ?? []), p.id]);
  }

  const units: ScheduledReportUnit[] = orgIds.flatMap((orgId) => {
    const props = propertiesByOrg.get(orgId) ?? [];
    return [
      { orgId, propertyId: null },
      ...(props.length >= 2 ? props.map((propertyId) => ({ orgId, propertyId })) : []),
    ];
  });

  const done = new Set(existing.map((r) => unitKey(r)));
  const lastAt = new Map(
    lastDrafts.map((r) => [unitKey(r), r._max.generatedAt?.getTime() ?? 0]),
  );
  const pending = units.filter((u) => !done.has(unitKey(u)));
  // Stable sort: ties keep org order with the org-wide draft first.
  const due = [...pending].sort(
    (a, b) => (lastAt.get(unitKey(a)) ?? 0) - (lastAt.get(unitKey(b)) ?? 0),
  );
  return { due, alreadyDrafted: units.length - pending.length };
}
