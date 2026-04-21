import "server-only";
import { prisma } from "@/lib/db";
import type { DetectedInsight } from "./types";

// ---------------------------------------------------------------------------
// Idempotent upsert for detected insights.
//
// Detectors fire on a schedule; without dedupe they'd repeatedly create the
// same row. Keyed on (orgId, dedupeKey). On re-detect we refresh body/context
// but preserve operator workflow state (status, acknowledgedAt, etc.).
// ---------------------------------------------------------------------------

export async function upsertInsights(
  orgId: string,
  detected: DetectedInsight[],
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const d of detected) {
    const existing = await prisma.insight.findUnique({
      where: { orgId_dedupeKey: { orgId, dedupeKey: d.dedupeKey } },
      select: { id: true, status: true },
    });

    if (!existing) {
      await prisma.insight.create({
        data: {
          orgId,
          propertyId: d.propertyId ?? null,
          kind: d.kind,
          category: d.category,
          severity: d.severity,
          title: d.title,
          body: d.body,
          suggestedAction: d.suggestedAction ?? null,
          entityType: d.entityType ?? null,
          entityId: d.entityId ?? null,
          href: d.href ?? null,
          context: (d.context as object) ?? undefined,
          dedupeKey: d.dedupeKey,
        },
      });
      inserted += 1;
    } else if (existing.status === "open" || existing.status === "acknowledged") {
      await prisma.insight.update({
        where: { id: existing.id },
        data: {
          severity: d.severity,
          title: d.title,
          body: d.body,
          suggestedAction: d.suggestedAction ?? null,
          context: (d.context as object) ?? undefined,
          href: d.href ?? null,
        },
      });
      updated += 1;
    }
  }

  return { inserted, updated };
}

/**
 * Close insights whose underlying condition no longer holds. Pass the set of
 * dedupe keys that the detector produced on this run; any existing open
 * insights of the same kinds whose keys are NOT in that set are auto-resolved.
 *
 * Example: pipeline_stall detector reports [key:lead_a, key:lead_b]. Lead C
 * was previously stalled (kind=pipeline_stall, status=open) but is no longer
 * detected — caller passes kinds=["pipeline_stall"] and we flip C to "acted".
 */
export async function autoResolveStale(
  orgId: string,
  kinds: string[],
  currentKeys: Set<string>,
): Promise<number> {
  if (kinds.length === 0) return 0;

  const stale = await prisma.insight.findMany({
    where: {
      orgId,
      kind: { in: kinds },
      status: { in: ["open", "acknowledged"] },
    },
    select: { id: true, dedupeKey: true },
  });

  const toResolve = stale.filter((s) => !currentKeys.has(s.dedupeKey));
  if (toResolve.length === 0) return 0;

  await prisma.insight.updateMany({
    where: { id: { in: toResolve.map((s) => s.id) } },
    data: { status: "acted", updatedAt: new Date() },
  });

  return toResolve.length;
}
