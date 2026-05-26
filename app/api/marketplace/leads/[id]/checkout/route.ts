import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/marketplace/auth";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { APP_URL } from "@/lib/email/shared";
import {
  MarketplaceLeadStatus,
  MarketplacePurchaseStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// POST /api/marketplace/leads/[id]/checkout
//
// Creates a Stripe Checkout session for the signed-in buyer to purchase
// this lead. Idempotent against an existing PENDING purchase from the
// same buyer (returns the existing checkout URL instead of creating a
// second session).
//
// Side effects:
//   - Reserves the lead (status → RESERVED) for 10 minutes while the
//     buyer completes checkout. The replenish cron + browse repo both
//     ignore RESERVED rows.
//   - Creates the buyer's Stripe Customer record on first purchase.
//   - Records a PENDING MarketplacePurchase row that the webhook will
//     update on success.
// ---------------------------------------------------------------------------

const RESERVATION_MS = 10 * 60 * 1000;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const buyer = await getBuyerSession();
  if (!buyer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const { id: leadId } = await ctx.params;

  // Atomically try to reserve the lead. We only flip AVAILABLE → RESERVED.
  // If another buyer beat us to it, we'll get count=0 and bail.
  const lead = await prisma.marketplaceLead.findUnique({
    where: { id: leadId },
  });
  if (!lead) {
    return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  }

  // If THIS buyer already owns it, bounce to the receipt instead.
  const owned = await prisma.marketplacePurchase.findFirst({
    where: {
      buyerId: buyer.id,
      leadId,
      status: MarketplacePurchaseStatus.PAID,
    },
  });
  if (owned) {
    return NextResponse.json({
      ok: true,
      alreadyOwned: true,
      receiptUrl: owned.receiptUrl,
    });
  }

  // If there's an existing PENDING purchase by this buyer for this lead,
  // return its checkout URL instead of creating a duplicate session.
  const pending = await prisma.marketplacePurchase.findFirst({
    where: {
      buyerId: buyer.id,
      leadId,
      status: MarketplacePurchaseStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });
  if (pending?.stripeCheckoutSessionId) {
    try {
      const session = await getStripeClient().checkout.sessions.retrieve(
        pending.stripeCheckoutSessionId,
      );
      if (session.status === "open" && session.url) {
        return NextResponse.json({ ok: true, checkoutUrl: session.url });
      }
    } catch {
      // Fall through to create a new session.
    }
  }

  if (
    lead.status !== MarketplaceLeadStatus.AVAILABLE &&
    lead.status !== MarketplaceLeadStatus.RESERVED
  ) {
    return NextResponse.json({ error: "lead_unavailable" }, { status: 409 });
  }

  const stripe = getStripeClient();

  // Lazy-create the Stripe Customer.
  let stripeCustomerId = buyer.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: buyer.email,
      name: buyer.fullName ?? undefined,
      metadata: { marketplaceBuyerId: buyer.id },
    });
    stripeCustomerId = customer.id;
    await prisma.marketplaceBuyer.update({
      where: { id: buyer.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  // Reserve the lead for 10 minutes. We only flip AVAILABLE — if someone
  // else already RESERVED it, we let our PENDING row coexist and the
  // webhook arbitrates who paid first.
  await prisma.marketplaceLead.updateMany({
    where: { id: leadId, status: MarketplaceLeadStatus.AVAILABLE },
    data: { status: MarketplaceLeadStatus.RESERVED },
  });

  const successUrl = `${APP_URL}/marketplace/buyer/purchases/{CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${APP_URL}/marketplace/${leadId}?canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: lead.priceCents,
          product_data: {
            name: `Lead · ${lead.market} · ${prettyType(lead.propertyType)}`,
            description: `Intent ${lead.intentScore} · ${lead.signal ?? ""}`,
            metadata: {
              marketplaceLeadId: lead.id,
            },
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      marketplaceLeadId: lead.id,
      marketplaceBuyerId: buyer.id,
    },
    payment_intent_data: {
      metadata: {
        marketplaceLeadId: lead.id,
        marketplaceBuyerId: buyer.id,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    expires_at: Math.floor((Date.now() + RESERVATION_MS) / 1000),
  });

  await prisma.marketplacePurchase.create({
    data: {
      leadId: lead.id,
      buyerId: buyer.id,
      origin: "DIRECT",
      stripeCheckoutSessionId: session.id,
      priceCents: lead.priceCents,
      currency: "usd",
      status: MarketplacePurchaseStatus.PENDING,
    },
  });

  return NextResponse.json({ ok: true, checkoutUrl: session.url });
}

function prettyType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
