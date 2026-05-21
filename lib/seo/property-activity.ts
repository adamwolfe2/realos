import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// getPropertyActivityFeed — compact 14-day event stream for one property.
// Combines AuditEvent (SeoActionRecommendation + ContentDraft) with
// recent ContentDraft creations. Hides anything older than 14 days
// to keep the feed scannable.
//
// Returns at most 12 items, sorted newest-first. The UI shows 10 with
// a 'and N more' affordance via the feed component's slice.
// ---------------------------------------------------------------------------

export type PropertyActivityItem = {
  id: string;
  kind: "rec_status" | "draft_event" | "rec_created";
  occurredAt: string;
  title: string;
  detail: string | null;
  href: string | null;
  tone: "neutral" | "positive" | "warning";
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getPropertyActivityFeed(input: {
  orgId: string;
  propertyId: string;
}): Promise<PropertyActivityItem[]> {
  const since = new Date(Date.now() - 14 * DAY_MS);

  // Pull AuditEvent for both SeoActionRecommendation + ContentDraft entity
  // types within this org, then drop anything that isn't tied to this
  // property. We can't filter by propertyId at the SQL level because
  // AuditEvent doesn't carry it directly — propertyId lives on the
  // referenced entity row.
  const [auditEvents, recentDrafts] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        orgId: input.orgId,
        createdAt: { gte: since },
        entityType: { in: ["SeoActionRecommendation", "ContentDraft"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        description: true,
        createdAt: true,
        diff: true,
      },
    }),
    prisma.contentDraft.findMany({
      where: {
        orgId: input.orgId,
        propertyId: input.propertyId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        format: true,
        brief: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  // Hydrate property-scoping for AuditEvent rows by looking up the
  // referenced entity ids. Batched per entity type.
  const recIds = new Set(
    auditEvents
      .filter((e) => e.entityType === "SeoActionRecommendation")
      .map((e) => e.entityId)
      .filter((id): id is string => !!id),
  );
  const draftIds = new Set(
    auditEvents
      .filter((e) => e.entityType === "ContentDraft")
      .map((e) => e.entityId)
      .filter((id): id is string => !!id),
  );

  const [recs, drafts] = await Promise.all([
    recIds.size > 0
      ? prisma.seoActionRecommendation
          .findMany({
            where: {
              id: { in: Array.from(recIds) },
              propertyId: input.propertyId,
            },
            select: { id: true, title: true },
          })
          .catch(() => [] as Array<{ id: string; title: string }>)
      : Promise.resolve([] as Array<{ id: string; title: string }>),
    draftIds.size > 0
      ? prisma.contentDraft
          .findMany({
            where: {
              id: { in: Array.from(draftIds) },
              propertyId: input.propertyId,
            },
            select: { id: true, format: true, brief: true },
          })
          .catch(
            () => [] as Array<{ id: string; format: string; brief: string }>,
          )
      : Promise.resolve(
          [] as Array<{ id: string; format: string; brief: string }>,
        ),
  ]);

  const recById = new Map(recs.map((r) => [r.id, r]));
  const draftById = new Map(drafts.map((d) => [d.id, d]));

  const items: PropertyActivityItem[] = [];

  // 1. Audit events that map to this property
  for (const e of auditEvents) {
    if (!e.entityId) continue;
    if (e.entityType === "SeoActionRecommendation") {
      const rec = recById.get(e.entityId);
      if (!rec) continue;
      const diff = (e.diff ?? {}) as {
        from?: string;
        to?: string;
        reason?: string | null;
      };
      const toStatus = diff.to ?? "?";
      const tone: PropertyActivityItem["tone"] =
        toStatus === "COMPLETED"
          ? "positive"
          : toStatus === "DISMISSED" || toStatus === "IN_PROGRESS"
            ? "neutral"
            : "warning";
      items.push({
        id: `ae-${e.id}`,
        kind: "rec_status",
        occurredAt: e.createdAt.toISOString(),
        title: `Recommendation marked ${toStatus.toLowerCase().replace(/_/g, " ")}`,
        detail: rec.title,
        href: "/portal/seo/agent",
        tone,
      });
    } else if (e.entityType === "ContentDraft") {
      const draft = draftById.get(e.entityId);
      if (!draft) continue;
      const diff = (e.diff ?? {}) as { from?: string; to?: string };
      const toStatus = diff.to ?? "?";
      const fmt = draft.format.replace(/_/g, " ").toLowerCase();
      const tone: PropertyActivityItem["tone"] =
        toStatus === "SHIPPED" || toStatus === "APPROVED"
          ? "positive"
          : toStatus === "REJECTED" || toStatus === "CHANGES_REQUESTED"
            ? "warning"
            : "neutral";
      items.push({
        id: `ae-${e.id}`,
        kind: "draft_event",
        occurredAt: e.createdAt.toISOString(),
        title: `Draft ${toStatus.toLowerCase().replace(/_/g, " ")}: ${fmt}`,
        detail: draft.brief.slice(0, 140),
        href: `/portal/seo/agent/drafts/${draft.id}`,
        tone,
      });
    }
  }

  // 2. New drafts (not already covered by an AuditEvent above)
  const seenDraftIds = new Set(
    auditEvents
      .filter((e) => e.entityType === "ContentDraft")
      .map((e) => e.entityId),
  );
  for (const d of recentDrafts) {
    if (seenDraftIds.has(d.id)) continue;
    const fmt = d.format.replace(/_/g, " ").toLowerCase();
    items.push({
      id: `draft-${d.id}`,
      kind: "draft_event",
      occurredAt: d.createdAt.toISOString(),
      title: `New draft submitted: ${fmt}`,
      detail: d.brief.slice(0, 140),
      href: `/portal/seo/agent/drafts/${d.id}`,
      tone: "neutral",
    });
  }

  // Sort newest first and cap.
  items.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  return items.slice(0, 12);
}
