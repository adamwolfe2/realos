import "server-only";

import { prisma } from "@/lib/db";
import { MarketplaceLeadStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Marketplace lead expiration — soft-delete pattern.
//
// Why soft-delete only:
//   - Hard deletes orphan downstream rows (purchases reference leadId with
//     ON DELETE Restrict; revenue / audit / payout history needs a stable
//     pointer to the lead row even after it leaves the marketplace).
//   - Forensics: "which lead did buyer X get last Tuesday?" must keep
//     working forever, even for leads that are no longer for sale.
//   - Replenishment uses status to gate visibility — flipping to EXPIRED
//     is the canonical "this lead is no longer in the pool" signal.
//
// This module is the ONE place callers should reach for to retire a lead.
// Direct prisma.marketplaceLead.delete[Many] outside of test fixtures is
// considered a bug; if you need a "remove a lead" flow in product code,
// add a wrapper here that takes a reason + writes a MarketplaceAuditEvent.
// ---------------------------------------------------------------------------

export type ExpireReason =
  | "STALE"             // expiresAt is in the past (default cron behaviour)
  | "DUPLICATE"         // re-ingestion detected the same person at a better source
  | "SELLER_PULLED"     // seller asked to retract the lead
  | "MANUAL"            // admin flipped it via the admin UI
  | "REPLENISH";        // cron-side replenish marked it expired during a refresh

export type ExpireOptions = {
  reason: ExpireReason;
  description?: string;
};

/**
 * Soft-delete a single MarketplaceLead by flipping status to EXPIRED and
 * writing a MarketplaceAuditEvent. Idempotent — re-running on an already
 * EXPIRED lead is a no-op (returns false).
 *
 * Won't expire a SOLD or RESERVED lead — those need an explicit refund /
 * release flow first.
 */
export async function expireLead(
  leadId: string,
  opts: ExpireOptions,
): Promise<boolean> {
  const lead = await prisma.marketplaceLead.findUnique({
    where: { id: leadId },
    select: { id: true, status: true, sellerId: true },
  });
  if (!lead) return false;
  if (lead.status === MarketplaceLeadStatus.EXPIRED) return false;
  // Don't expire active sales — refund flow should handle those.
  if (
    lead.status === MarketplaceLeadStatus.SOLD ||
    lead.status === MarketplaceLeadStatus.RESERVED
  ) {
    return false;
  }

  await prisma.$transaction([
    prisma.marketplaceLead.update({
      where: { id: lead.id },
      data: { status: MarketplaceLeadStatus.EXPIRED },
    }),
    prisma.marketplaceAuditEvent.create({
      data: {
        action: "LEAD_EXPIRED",
        leadId: lead.id,
        sellerId: lead.sellerId,
        description: opts.description ?? `Expired (${opts.reason})`,
        metadata: { reason: opts.reason },
      },
    }),
  ]);
  return true;
}

/**
 * Bulk soft-delete by id list. Skips already-EXPIRED rows and active sales.
 * Writes one MarketplaceAuditEvent per actually-expired row.
 *
 * Returns { expiredCount } for caller observability.
 */
export async function expireLeads(
  leadIds: string[],
  opts: ExpireOptions,
): Promise<{ expiredCount: number }> {
  if (leadIds.length === 0) return { expiredCount: 0 };

  // Only flip AVAILABLE rows — keep RESERVED / SOLD untouched.
  const updatable = await prisma.marketplaceLead.findMany({
    where: {
      id: { in: leadIds },
      status: MarketplaceLeadStatus.AVAILABLE,
    },
    select: { id: true, sellerId: true },
  });
  if (updatable.length === 0) return { expiredCount: 0 };

  const ids = updatable.map((l) => l.id);
  await prisma.$transaction([
    prisma.marketplaceLead.updateMany({
      where: { id: { in: ids } },
      data: { status: MarketplaceLeadStatus.EXPIRED },
    }),
    prisma.marketplaceAuditEvent.createMany({
      data: updatable.map((l) => ({
        action: "LEAD_EXPIRED",
        leadId: l.id,
        sellerId: l.sellerId,
        description: opts.description ?? `Expired (${opts.reason})`,
        metadata: { reason: opts.reason },
      })),
    }),
  ]);
  return { expiredCount: ids.length };
}

/**
 * Reap leads whose expiresAt has passed. Runs daily via
 * /api/cron/marketplace-expire. Only touches AVAILABLE rows so an active
 * sale or stream subscription isn't disrupted mid-flow.
 *
 * Returns a summary suitable for the cron response payload.
 */
export async function reapStaleLeads(now: Date = new Date()): Promise<{
  expiredCount: number;
  cutoff: string;
}> {
  // Find candidates first so we can write per-row audit events. updateMany
  // alone would flip status without audit context.
  const candidates = await prisma.marketplaceLead.findMany({
    where: {
      status: MarketplaceLeadStatus.AVAILABLE,
      expiresAt: { lt: now },
    },
    select: { id: true },
    // Soft cap — if a cron run finds more than 5K stale rows, we expire the
    // first batch and let the next run pick up the rest. Keeps the txn
    // within Neon HTTP's payload limits.
    take: 5000,
  });
  if (candidates.length === 0) {
    return { expiredCount: 0, cutoff: now.toISOString() };
  }

  const { expiredCount } = await expireLeads(
    candidates.map((c) => c.id),
    {
      reason: "STALE",
      description: `Lead past expiresAt cutoff (${now.toISOString()})`,
    },
  );
  return { expiredCount, cutoff: now.toISOString() };
}
