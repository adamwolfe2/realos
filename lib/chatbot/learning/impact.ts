import { prisma } from "@/lib/db";

// Before/after for an applied fix: how often the pattern the fix targets
// showed up in the N days before it went live vs the N days since. Both
// windows are the same length so the numbers compare honestly, and chat
// volume rides along so a quiet week doesn't read as a win.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 30;
export const MIN_DAYS = 7;

// Each suggestion pattern is built from one learning-case family; the case
// dedupeKey prefix (engine.ts) identifies the family.
const CASE_PREFIX: Record<string, { prefix: string; label: string }> = {
  weak_cta_human_contact_punt: {
    prefix: "human-contact-punt:",
    label: "Chats sent to “contact leasing” with no next step",
  },
  capture_after_pricing_or_availability: {
    prefix: "uncaptured-engaged:",
    label: "Pricing or availability chats left without contact info",
  },
};

export type FixImpact =
  | { kind: "too_early"; daysLive: number }
  | {
      kind: "measured";
      label: string;
      days: number;
      before: number;
      after: number;
      chatsBefore: number;
      chatsAfter: number;
    };

/** Equal-length windows either side of appliedAt; null when under MIN_DAYS. */
export function impactWindow(appliedAt: Date, measuredUntil: Date) {
  const daysLive = Math.floor((measuredUntil.getTime() - appliedAt.getTime()) / DAY_MS);
  if (daysLive < MIN_DAYS) return { daysLive, window: null };
  const days = Math.min(daysLive, MAX_DAYS);
  return {
    daysLive,
    window: {
      days,
      beforeStart: new Date(appliedAt.getTime() - days * DAY_MS),
      appliedAt,
      afterEnd: new Date(appliedAt.getTime() + days * DAY_MS),
    },
  };
}

/** Counts dates in [beforeStart, appliedAt) and [appliedAt, afterEnd). */
export function splitCounts(
  dates: Date[],
  w: { beforeStart: Date; appliedAt: Date; afterEnd: Date },
): { before: number; after: number } {
  let before = 0;
  let after = 0;
  for (const d of dates) {
    const t = d.getTime();
    if (t >= w.beforeStart.getTime() && t < w.appliedAt.getTime()) before++;
    else if (t >= w.appliedAt.getTime() && t < w.afterEnd.getTime()) after++;
  }
  return { before, after };
}

/**
 * Impact per applied fix. `measuredUntil` should be when the learning loop
 * last ran: chats newer than that have not been classified yet, so counting
 * them would fake an improvement.
 */
export async function loadFixImpact(
  orgId: string,
  fixes: { id: string; propertyId: string | null; patternType: string; appliedAt: Date | null }[],
  measuredUntil: Date,
): Promise<Map<string, FixImpact>> {
  const out = new Map<string, FixImpact>();
  await Promise.all(
    fixes.map(async (fix) => {
      const pattern = CASE_PREFIX[fix.patternType];
      if (!pattern || !fix.appliedAt) return;
      const { daysLive, window: w } = impactWindow(fix.appliedAt, measuredUntil);
      if (!w) {
        out.set(fix.id, { kind: "too_early", daysLive: Math.max(0, daysLive) });
        return;
      }
      const span = { gte: w.beforeStart, lt: w.afterEnd };
      // Fixes are grouped per property (null = chats with no property).
      const propertyId = fix.propertyId;
      const [cases, chats] = await Promise.all([
        prisma.chatbotLearningCase.findMany({
          where: {
            orgId,
            propertyId,
            dedupeKey: { startsWith: pattern.prefix },
            conversation: { createdAt: span },
          },
          select: { conversation: { select: { createdAt: true } } },
        }),
        prisma.chatbotConversation.findMany({
          where: { orgId, propertyId, createdAt: span },
          select: { createdAt: true },
        }),
      ]);
      const hits = splitCounts(
        cases.flatMap((c) => (c.conversation ? [c.conversation.createdAt] : [])),
        w,
      );
      const vol = splitCounts(
        chats.map((c) => c.createdAt),
        w,
      );
      out.set(fix.id, {
        kind: "measured",
        label: pattern.label,
        days: w.days,
        before: hits.before,
        after: hits.after,
        chatsBefore: vol.before,
        chatsAfter: vol.after,
      });
    }),
  );
  return out;
}
