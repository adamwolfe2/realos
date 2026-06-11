import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import {
  MarketplaceLeadStatus,
  MarketplacePurchaseStatus,
} from "@prisma/client";
import { getStripeClient } from "@/lib/stripe/config";
import { sendLeadDeliveryEmail } from "@/lib/marketplace/emails";

// ---------------------------------------------------------------------------
// Marketplace Stripe webhook handlers
//
// These handlers are extracted from /api/webhooks/stripe/marketplace so the
// existing LeaseStack billing webhook at /api/webhooks/stripe can ALSO
// route marketplace events here without duplicating the logic.
//
// Each handler is idempotent (re-running on a duplicate webhook delivery
// is safe — status checks gate every mutation) and short-circuits early
// when the event isn't actually a marketplace purchase.
//
// Detection: marketplace checkout sessions are created with
// metadata.marketplaceLeadId. handleMarketplaceCheckoutCompleted (and
// _Expired) check that metadata first and return false if absent so the
// caller knows "this wasn't a marketplace event, continue your normal
// flow." charge.refunded events don't carry metadata directly so we
// look up by paymentIntentId — null result means "not a marketplace
// charge."
// ---------------------------------------------------------------------------

/**
 * Returns true if the event was a marketplace purchase and we handled it.
 * Returns false if the session has no marketplaceLeadId metadata (caller
 * should fall through to their existing handler).
 */
export async function handleMarketplaceCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  const leadId = session.metadata?.marketplaceLeadId;
  if (!leadId) return false;

  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    include: { lead: true, buyer: true },
  });
  if (!purchase) {
    console.warn(
      "marketplace webhook — purchase not found for session",
      session.id,
    );
    return true;
  }
  // Idempotency: skip if already paid.
  if (purchase.status === MarketplacePurchaseStatus.PAID) return true;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Best-effort receipt URL lookup. Missing receipt doesn't block delivery.
  let receiptUrl: string | null = null;
  if (paymentIntentId) {
    try {
      const pi = await getStripeClient().paymentIntents.retrieve(
        paymentIntentId,
        { expand: ["latest_charge"] },
      );
      const charge = pi.latest_charge as Stripe.Charge | null;
      receiptUrl = charge?.receipt_url ?? null;
    } catch {
      // ignore
    }
  }

  // Comp / 100%-off promo flow: when the buyer used a promotion code that
  // dropped the actual paid amount to $0, we still flip the lead to SOLD
  // and deliver the PII (so the full end-to-end flow is exercised), BUT
  // we DON'T credit the seller's accrued totals against money that was
  // never collected. Detected via session.amount_total === 0.
  const amountPaidCents = session.amount_total ?? purchase.priceCents;
  const isComp = amountPaidCents === 0;

  // Snapshot the seller revenue split at sale time.
  const lead = purchase.lead;

  let sellerSplit: {
    sellerIdAtSale: string | null;
    sellerShareBps: number | null;
    sellerShareCents: number | null;
    platformShareCents: number | null;
  } = {
    sellerIdAtSale: null,
    sellerShareBps: null,
    sellerShareCents: null,
    // Split the ACTUAL collected amount, not list price — a partial promo
    // discount would otherwise owe the seller more than we took in. (Codex.)
    platformShareCents: isComp ? 0 : amountPaidCents,
  };
  if (lead.sellerId && !isComp) {
    const seller = await prisma.marketplaceSeller.findUnique({
      where: { id: lead.sellerId },
      select: { id: true, revShareBps: true },
    });
    if (seller) {
      const bps = seller.revShareBps;
      const sellerShareCents = Math.floor((amountPaidCents * bps) / 10000);
      sellerSplit = {
        sellerIdAtSale: seller.id,
        sellerShareBps: bps,
        sellerShareCents,
        platformShareCents: amountPaidCents - sellerShareCents,
      };
    }
  } else if (lead.sellerId && isComp) {
    // Record the attribution but zero the dollars — keeps the audit trail
    // (we can see WHICH seller's lead got comped) without accruing money.
    sellerSplit = {
      sellerIdAtSale: lead.sellerId,
      sellerShareBps: 0,
      sellerShareCents: 0,
      platformShareCents: 0,
    };
  }

  // ── Atomic settlement (launch-critical-sweep P1 + Codex review) ───────────
  // Of N concurrent paid webhooks for one lead, exactly ONE wins. The
  // conditional claim (status != SOLD, strict) runs in the SAME transaction
  // that marks the purchase PAID, credits the seller, and writes the audit, so
  // the lead-SOLD flip and the PAID/credit can never diverge. Winner retries
  // are handled by the `status === PAID` early-return at the top of this
  // handler, so two purchases by the SAME buyer can't both win (the earlier
  // buyer-scoped OR predicate let them — Codex finding).
  const won = await prisma.$transaction(async (tx) => {
    const claim = await tx.marketplaceLead.updateMany({
      where: {
        id: purchase.leadId,
        status: { not: MarketplaceLeadStatus.SOLD },
      },
      data: {
        status: MarketplaceLeadStatus.SOLD,
        soldToBuyerId: purchase.buyerId,
        soldAt: new Date(),
      },
    });
    if (claim.count === 0) return false;

    await tx.marketplacePurchase.update({
      where: { id: purchase.id },
      data: {
        status: MarketplacePurchaseStatus.PAID,
        // Comp purchases flip origin to COMP so dashboards + reports can
        // exclude them from revenue / payout numbers.
        ...(isComp ? { origin: "COMP" } : {}),
        stripePaymentIntentId: paymentIntentId,
        receiptUrl,
        piiDeliveredAt: new Date(),
        sellerIdAtSale: sellerSplit.sellerIdAtSale,
        sellerShareBps: sellerSplit.sellerShareBps,
        sellerShareCents: sellerSplit.sellerShareCents,
        platformShareCents: sellerSplit.platformShareCents,
      },
    });
    if (sellerSplit.sellerIdAtSale && sellerSplit.sellerShareCents) {
      await tx.marketplaceSeller.update({
        where: { id: sellerSplit.sellerIdAtSale },
        data: {
          accruedCents: { increment: sellerSplit.sellerShareCents },
          unpaidOwedCents: { increment: sellerSplit.sellerShareCents },
          totalLeadsSold: { increment: 1 },
        },
      });
    }
    await tx.marketplaceAuditEvent.create({
      data: {
        action: isComp ? "PURCHASE_COMP_GRANTED" : "LEAD_SOLD",
        leadId: purchase.leadId,
        purchaseId: purchase.id,
        buyerId: purchase.buyerId,
        sellerId: sellerSplit.sellerIdAtSale,
        amountCents: amountPaidCents,
        sellerShareCents: sellerSplit.sellerShareCents,
        description: isComp
          ? `Comp purchase ($0) — lead delivered, no seller credit accrued`
          : `Lead sold via ${purchase.origin} origin`,
        metadata: {
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          origin: isComp ? "COMP" : purchase.origin,
          priceCents: purchase.priceCents,
          sellerShareBps: sellerSplit.sellerShareBps,
        },
      },
    });
    return true;
  });

  if (!won) {
    // Did THIS purchase already win via a concurrent DUPLICATE webhook (the same
    // Stripe event delivered twice)? One delivery claims the lead + marks this
    // purchase PAID inside the tx; the other sees SOLD and lands here. That's
    // not a loss — never refund the valid winner. (Codex finding.)
    const current = await prisma.marketplacePurchase.findUnique({
      where: { id: purchase.id },
      select: { status: true },
    });
    // Short-circuit BOTH terminal states: PAID means a duplicate webhook for
    // the winner; REFUNDED means a retried loser delivery already settled this
    // one — re-running would write a duplicate LEAD_REFUNDED audit. (Codex.)
    if (
      current?.status === MarketplacePurchaseStatus.PAID ||
      current?.status === MarketplacePurchaseStatus.REFUNDED
    ) {
      return true;
    }

    // Genuine loser — lost the lead to a DIFFERENT buyer's purchase. Refund,
    // mark REFUNDED, never deliver the PII.
    if (paymentIntentId && !isComp) {
      try {
        await getStripeClient().refunds.create(
          { payment_intent: paymentIntentId },
          // Idempotency keyed on the purchase so a webhook retry can't issue a
          // second refund. (Codex finding.)
          { idempotencyKey: `mp_refund_${purchase.id}` },
        );
      } catch (err) {
        // Refund FAILED — the buyer is still charged. THROW so the route returns
        // 500 and Stripe RETRIES this webhook (and the refund). The route
        // ignores a boolean return (it always 200s), so returning here would
        // silently strand a charged buyer. (Codex findings.)
        console.error(
          "marketplace — CRITICAL: refund failed for double-sale loser; buyer still charged, throwing to force Stripe retry",
          { purchaseId: purchase.id, leadId: purchase.leadId, paymentIntentId },
          err,
        );
        throw err instanceof Error
          ? err
          : new Error("marketplace refund failed");
      }
    }
    // Mark REFUNDED + write the audit atomically, and let failures THROW (not
    // swallow): the refund already succeeded, so a swallowed DB failure would
    // strand a refunded purchase as PENDING + return 200. Throwing makes Stripe
    // retry; the refund's idempotency key keeps the retry safe. (Codex finding.)
    await prisma.$transaction([
      prisma.marketplacePurchase.update({
        where: { id: purchase.id },
        data: {
          status: MarketplacePurchaseStatus.REFUNDED,
          stripePaymentIntentId: paymentIntentId,
          // No piiDeliveredAt — the buyer never received the lead.
        },
      }),
      prisma.marketplaceAuditEvent.create({
        data: {
          action: "LEAD_REFUNDED",
          leadId: purchase.leadId,
          purchaseId: purchase.id,
          buyerId: purchase.buyerId,
          amountCents: amountPaidCents,
          description:
            "Refunded — lead already sold to another buyer (lost the purchase race)",
          metadata: {
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
          },
        },
      }),
    ]);
    return true;
  }

  // Send the buyer their PII email. Failure doesn't unwind the sale.
  const fullName = [lead.firstName, lead.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const result = await sendLeadDeliveryEmail({
    to: purchase.buyer.email,
    buyerName: purchase.buyer.fullName,
    leadId: lead.id,
    fullName: fullName || "Unknown",
    email: lead.email,
    phone: lead.phone,
    market: lead.market,
    propertyType: lead.propertyType,
    intentScore: lead.intentScore,
    signal: lead.signal,
    budgetLabel: lead.budgetLabel,
    timeline: lead.timeline,
    pricePaidCents: purchase.priceCents,
    receiptUrl,
  });
  if (result.ok) {
    await prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: { receiptSentAt: new Date() },
    });
  } else {
    console.error("marketplace — delivery email failed", result.error);
  }
  return true;
}

export async function handleMarketplaceCheckoutExpired(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (!session.metadata?.marketplaceLeadId) return false;

  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (!purchase) return true;
  if (purchase.status !== MarketplacePurchaseStatus.PENDING) return true;

  await prisma.$transaction([
    prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: { status: MarketplacePurchaseStatus.FAILED },
    }),
    prisma.marketplaceLead.updateMany({
      where: {
        id: purchase.leadId,
        status: MarketplaceLeadStatus.RESERVED,
      },
      data: { status: MarketplaceLeadStatus.AVAILABLE },
    }),
    prisma.marketplaceAuditEvent.create({
      data: {
        action: "PURCHASE_EXPIRED",
        leadId: purchase.leadId,
        purchaseId: purchase.id,
        buyerId: purchase.buyerId,
        amountCents: purchase.priceCents,
        description: "Stripe checkout session expired before payment",
        metadata: { stripeSessionId: session.id },
      },
    }),
  ]);
  return true;
}

/**
 * charge.refunded events don't carry our metadata, so we look up by
 * paymentIntentId. Returns true if we found and handled a marketplace
 * purchase, false if no marketplace purchase exists for this charge.
 */
export async function handleMarketplaceChargeRefunded(
  charge: Stripe.Charge,
): Promise<boolean> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return false;

  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!purchase) return false;
  if (purchase.status === MarketplacePurchaseStatus.REFUNDED) return true;

  const refundReason = charge.refunds?.data?.[0]?.reason ?? null;

  // Atomic: only ONE concurrent charge.refunded webhook flips the purchase to
  // REFUNDED (count === 1); a duplicate delivery gets 0 and skips — so the
  // seller credit is reversed EXACTLY once. The flip, the seller-credit
  // reversal, and the audit all commit together. (Codex finding: the prior
  // read-then-write REFUNDED check could double-reverse on concurrent dupes.)
  await prisma.$transaction(async (tx) => {
    const flip = await tx.marketplacePurchase.updateMany({
      where: {
        id: purchase.id,
        status: { not: MarketplacePurchaseStatus.REFUNDED },
      },
      data: {
        status: MarketplacePurchaseStatus.REFUNDED,
        refundedAt: new Date(),
        refundReason,
      },
    });
    if (flip.count === 0) return; // already refunded by a concurrent delivery

    // Reverse the seller's accrued credit for the refunded sale — otherwise we'd
    // pay out for a sale we gave the money back on. Mirrors the sale-time
    // increment. (Codex finding: refunds never reversed seller accrual.)
    if (purchase.sellerIdAtSale && purchase.sellerShareCents) {
      await tx.marketplaceSeller.update({
        where: { id: purchase.sellerIdAtSale },
        data: {
          accruedCents: { decrement: purchase.sellerShareCents },
          unpaidOwedCents: { decrement: purchase.sellerShareCents },
          totalLeadsSold: { decrement: 1 },
        },
      });
    }
    await tx.marketplaceAuditEvent.create({
      data: {
        action: "LEAD_REFUNDED",
        leadId: purchase.leadId,
        purchaseId: purchase.id,
        buyerId: purchase.buyerId,
        sellerId: purchase.sellerIdAtSale,
        amountCents: charge.amount_refunded ?? purchase.priceCents,
        sellerShareCents: purchase.sellerShareCents,
        description: refundReason
          ? `Refund issued: ${refundReason}`
          : "Refund issued",
        metadata: {
          stripeChargeId: charge.id,
          stripePaymentIntentId: paymentIntentId,
          refundReason,
        },
      },
    });
  });
  return true;
}
