import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Webhook idempotency.
//
// Stripe retries delivered events on any non-2xx response or timeout. Our
// dispatchers do real side effects (Org provisioning, Clerk invite, email
// send) so a duplicate delivery would double-provision unless we gate.
//
// Strategy: `ProcessedStripeEvent` table acts as a first-write-wins lock.
// On each webhook event we try to insert the row inside the same
// transaction as the side effect. If the insert succeeds, this is the
// first time we've seen this event id — proceed. If the insert raises
// a unique-violation, the event has already been processed (or is being
// processed RIGHT NOW by a parallel retry); skip the side effect.
//
// Stripe's retry budget is 3 days, but we keep rows for 30 days so the
// `processedAt` index supports debugging "did this event reach us?"
// queries without needing the audit log.
// ---------------------------------------------------------------------------

/**
 * Wrap a webhook side effect with idempotent dispatch. The handler runs
 * INSIDE the transaction so the insert + side effect either both commit or
 * both roll back. Caller passes any context that should be retained on the
 * dedupe row (proposalId, orgId) for forensic queries.
 *
 *   await processStripeEventOnce(
 *     { eventId: event.id, eventType: event.type, proposalId },
 *     async (tx) => {
 *       await provisionOrg(tx, proposalId);
 *     },
 *   );
 *
 * The provided `tx` is a Prisma transaction client. Callers SHOULD pass
 * this to any nested Prisma calls so the rollback fence holds; calls that
 * use the global `prisma` instead will commit independently and break
 * the idempotency guarantee.
 */
export async function processStripeEventOnce(
  args: {
    eventId: string;
    eventType: string;
    proposalId?: string | null;
    orgId?: string | null;
  },
  handler: (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ) => Promise<void>,
): Promise<{ status: "processed" | "skipped" }> {
  try {
    await prisma.$transaction(async (tx) => {
      // First-write-wins: this throws P2002 on a duplicate event id, which
      // we catch below to short-circuit the handler. We MUST do the insert
      // BEFORE the handler so the lock is held throughout the side effect.
      await tx.processedStripeEvent.create({
        data: {
          eventId: args.eventId,
          eventType: args.eventType,
          proposalId: args.proposalId ?? null,
          orgId: args.orgId ?? null,
        },
      });
      await handler(tx);
    });
    return { status: "processed" };
  } catch (err) {
    const isUnique =
      err != null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002";
    if (isUnique) {
      return { status: "skipped" };
    }
    throw err;
  }
}

/**
 * Check whether an event id has been processed already, WITHOUT mutating
 * state. Useful for diagnostics + the admin "replay event" UI. Production
 * paths should call `processStripeEventOnce` instead so the check and the
 * insert happen atomically.
 */
export async function isStripeEventProcessed(
  eventId: string,
): Promise<boolean> {
  const row = await prisma.processedStripeEvent.findUnique({
    where: { eventId },
    select: { eventId: true },
  });
  return row != null;
}
