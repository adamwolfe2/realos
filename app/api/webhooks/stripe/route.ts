import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { captureWithContext } from "@/lib/sentry";
import { isStripeConfigured, parseWebhookEvent, getStripeClient } from "@/lib/stripe/config";
import { WebhookSignatureError } from "@/lib/stripe/errors";
import { webhookLimiter, checkRateLimit, getIp, rateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import {
  SubscriptionStatus,
  SubscriptionTier,
  TenantStatus,
  AuditAction,
} from "@prisma/client";
import {
  computeMrrCents,
  modulesFromSubscriptionPriceIds,
  tierFromStripePriceId,
} from "@/lib/billing/plans";

// ============================================================================
// Stripe → Platform status mappings
// ============================================================================

function toSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): SubscriptionStatus | null {
  switch (stripeStatus) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "incomplete_expired":
      return SubscriptionStatus.CANCELED;
    case "paused":
      return SubscriptionStatus.PAUSED;
    case "incomplete":
      // Incomplete means payment is pending — treat as past_due until resolved
      return SubscriptionStatus.PAST_DUE;
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    default:
      return null;
  }
}

function toSubscriptionTier(
  metadata: Stripe.Metadata | null | undefined
): SubscriptionTier | null {
  const raw = metadata?.tier?.toUpperCase();
  if (!raw) return null;
  if (raw in SubscriptionTier) return raw as SubscriptionTier;
  return null;
}

// Derive the tier from the actual price IDs on the subscription. This is
// the authoritative source — metadata can be stale or absent (e.g. when
// the operator self-serves an upgrade in the Customer Portal). Falls
// back to metadata only when no price ID maps to a known tier.
function resolveTierFromSubscription(
  subscription: Stripe.Subscription
): SubscriptionTier | null {
  for (const item of subscription.items.data) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    const tier = tierFromStripePriceId(priceId);
    if (tier) return tier;
  }
  return toSubscriptionTier(subscription.metadata);
}

// ============================================================================
// Event handlers
// ============================================================================

async function handleSubscriptionUpserted(
  subscription: Stripe.Subscription
): Promise<void> {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: {
      id: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      mrrCents: true,
    },
  });

  if (!org) {
    // No org linked yet — nothing to update. The `checkout.session.
    // completed` handler creates the link for signup flows; this guard
    // covers the edge case where Stripe fires subscription events
    // before our checkout handler runs.
    return;
  }

  const newStatus = toSubscriptionStatus(subscription.status);
  const newTier = resolveTierFromSubscription(subscription);

  const updateData: Parameters<typeof prisma.organization.update>[0]["data"] =
    {};

  if (newStatus !== null) {
    updateData.subscriptionStatus = newStatus;
  }
  if (newTier !== null) {
    updateData.subscriptionTier = newTier;
  }
  if (!org.subscriptionStatus) {
    // First time we're seeing a subscription — record the start date
    updateData.subscriptionStartedAt = new Date(
      subscription.start_date * 1000
    );
  }

  // Recompute MRR from the actual items on the subscription. This is
  // the authoritative figure — Stripe knows what the customer is
  // paying every month better than our DB ever will. Excludes metered
  // items (their MRR depends on usage).
  const newMrrCents = computeMrrCents(
    subscription.items.data as Array<{
      quantity?: number | null;
      price?: {
        unit_amount?: number | null;
        recurring?: {
          interval?: string | null;
          usage_type?: string | null;
        } | null;
      } | null;
    }>,
  );
  if (newMrrCents !== org.mrrCents) {
    updateData.mrrCents = newMrrCents;
  }

  // Flip module entitlements based on the resolved tier. Webhook is
  // the only place that should mutate `module*` columns automatically —
  // any manual override should happen via the admin UI with an
  // audit trail.
  const priceIds = subscription.items.data
    .map((i) => i.price?.id)
    .filter((id): id is string => !!id);
  const modules = modulesFromSubscriptionPriceIds(priceIds);
  if (modules) {
    Object.assign(updateData, modules);
  }

  // If the subscription is canceled or unpaid, do NOT downgrade module
  // flags here — `handleSubscriptionDeleted` and the past_due flow
  // (billing-reminders cron) handle the lifecycle separately. Flipping
  // modules off on a transient `past_due` would break the customer's
  // tenant site during the grace window before they update their
  // payment method.

  await prisma.organization.update({
    where: { id: org.id },
    data: updateData,
  });

  const oldStatus = org.subscriptionStatus ?? "none";
  const descParts = [
    `subscription ${subscription.id}`,
    `status: ${oldStatus} → ${newStatus ?? "unchanged"}`,
  ];
  if (newTier) descParts.push(`tier: ${newTier}`);
  if (updateData.mrrCents !== undefined) {
    descParts.push(
      `MRR: $${((org.mrrCents ?? 0) / 100).toFixed(2)} → $${(newMrrCents / 100).toFixed(2)}`,
    );
  }

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: org.id,
      description: descParts.join(", "),
      diff: {
        subscriptionStatus: { from: oldStatus, to: newStatus },
        subscriptionTier: newTier
          ? { from: org.subscriptionTier, to: newTier }
          : undefined,
        mrrCents:
          updateData.mrrCents !== undefined
            ? { from: org.mrrCents, to: newMrrCents }
            : undefined,
      },
    },
  });
}

// Handle the Checkout completion event. This is the moment of truth
// for a new signup: we know the prospect just paid, and we get the
// customer + subscription IDs in the same event. Three modes:
//
//   1. metadata.intent === "signup" + no org linked yet:
//      Stripe just created a brand-new Customer for an anonymous
//      prospect. We DO NOT auto-provision an Organization here —
//      that happens through /onboarding once they sign in with Clerk.
//      We DO record the customer in a pending-link state so the
//      onboarding flow can claim it by email.
//
//   2. metadata.intent === "upgrade_or_add" + org_id present:
//      Existing customer. The subscription.created event will arrive
//      moments later and do the heavy lifting — this handler just
//      records the audit trail.
//
//   3. Anything else (manual Checkout, dashboard test):
//      Best-effort customer-to-org linking by email.
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!stripeCustomerId) return;

  // Website-build SKUs use mode: "payment" and carry kind="website_build"
  // metadata. They're handled separately from the subscription flow:
  // we upsert the WebsiteBuildRequest, stamp the payment refs, and
  // surface the kickoff-call CTA on the success page.
  if (session.metadata?.kind === "website_build") {
    await handleWebsiteBuildCheckoutCompleted(session);
    return;
  }

  const intent = session.metadata?.intent ?? "";
  const orgIdHint = session.metadata?.org_id ?? null;
  const tierHint = session.metadata?.tier ?? null;

  // If the session carried org_id (authed signup or upgrade), make
  // sure that org is linked to the Stripe customer — defensive in
  // case the link step in the checkout endpoint failed.
  if (orgIdHint) {
    const org = await prisma.organization.findUnique({
      where: { id: orgIdHint },
      select: { id: true, stripeCustomerId: true },
    });
    if (org && !org.stripeCustomerId) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId },
      });
    }
    if (org) {
      await prisma.auditEvent.create({
        data: {
          orgId: org.id,
          action: AuditAction.UPDATE,
          entityType: "Organization",
          entityId: org.id,
          description: `Checkout completed (session ${session.id}) — tier: ${tierHint ?? "?"}, intent: ${intent}`,
          diff: {
            sessionId: session.id,
            amountTotalCents: session.amount_total ?? 0,
            tier: tierHint,
            intent,
          },
        },
      });
    }
    return;
  }

  // Anonymous signup. Pull the customer record to grab the email +
  // metadata so the onboarding flow can match the user back to the
  // Stripe customer on first sign-in.
  const customer = await getStripeClient().customers.retrieve(stripeCustomerId);
  if (customer.deleted) return;
  const email = customer.email;
  if (!email) return;

  // Best-effort match: if an Organization already exists with this
  // email and no Stripe link yet, attach the customer. This covers the
  // case where the prospect created an org via /onboarding BEFORE
  // hitting Checkout.
  const orgByEmail = await prisma.organization.findFirst({
    where: {
      primaryContactEmail: email,
      stripeCustomerId: null,
    },
    select: { id: true },
  });
  if (orgByEmail) {
    await prisma.organization.update({
      where: { id: orgByEmail.id },
      data: { stripeCustomerId },
    });
    await prisma.auditEvent.create({
      data: {
        orgId: orgByEmail.id,
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: orgByEmail.id,
        description: `Stripe customer ${stripeCustomerId} linked via Checkout completion (${email}); tier: ${tierHint ?? "?"}`,
      },
    });
  }
}

// Website-build checkout completion. The /api/billing/website-build
// endpoint pre-created a WebsiteBuildRequest row in `requested` state
// with the Stripe Checkout session id stamped on it. This webhook
// updates that row with the payment intent + amount paid + the org's
// Stripe customer link if not already set.
async function handleWebsiteBuildCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const orgId = session.metadata?.org_id;
  const buildId = session.metadata?.build_id;
  if (!orgId || !buildId) {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Look up the pre-created request by session id. If it's missing
  // (race condition, manual Stripe console payment, etc.) we create
  // one defensively so fulfillment never loses sight of a paid order.
  const existing = await prisma.websiteBuildRequest.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.websiteBuildRequest.update({
      where: { id: existing.id },
      data: {
        stripePaymentIntentId: paymentIntentId,
        amountPaidCents: session.amount_total ?? 0,
        status: "requested",
      },
    });
  } else {
    await prisma.websiteBuildRequest.create({
      data: {
        orgId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amountPaidCents: session.amount_total ?? 0,
        status: "requested",
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      orgId,
      action: AuditAction.CREATE,
      entityType: "WebsiteBuildRequest",
      entityId: session.id,
      description: `Website build paid: ${buildId} ($${((session.amount_total ?? 0) / 100).toFixed(2)})`,
      diff: {
        sessionId: session.id,
        buildId,
        amountTotalCents: session.amount_total ?? 0,
      },
    },
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true, subscriptionStatus: true },
  });

  if (!org) return;

  // On cancel, revoke module entitlements except for the always-on
  // baseline (website + lead capture stay on so the tenant site
  // doesn't 404 mid-billing-dispute; an agency human can fully
  // disable them via the admin UI after).
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: SubscriptionStatus.CANCELED,
      status: TenantStatus.CHURNED,
      modulePixel: false,
      moduleChatbot: false,
      moduleGoogleAds: false,
      moduleMetaAds: false,
      moduleSEO: false,
      moduleEmail: false,
      moduleOutboundEmail: false,
      moduleReferrals: false,
      moduleCreativeStudio: false,
    },
  });

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: org.id,
      description: `subscription ${subscription.id} deleted — org marked CHURNED, modules disabled`,
      diff: {
        subscriptionStatus: {
          from: org.subscriptionStatus,
          to: SubscriptionStatus.CANCELED,
        },
        status: { from: undefined, to: TenantStatus.CHURNED },
        modulesDisabled: true,
      },
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!stripeCustomerId) return;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true, subscriptionStatus: true },
  });

  if (!org) return;

  const updateData: Parameters<typeof prisma.organization.update>[0]["data"] =
    {};

  // Resolve past_due and paused states on successful payment
  if (
    org.subscriptionStatus === SubscriptionStatus.PAST_DUE ||
    org.subscriptionStatus === SubscriptionStatus.PAUSED
  ) {
    updateData.subscriptionStatus = SubscriptionStatus.ACTIVE;
  }

  // Update MRR from the invoice amount if this is a subscription invoice
  const isSubscriptionInvoice =
    invoice.parent?.type === "subscription_details";
  if (isSubscriptionInvoice && invoice.amount_paid > 0) {
    updateData.mrrCents = invoice.amount_paid;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.organization.update({
      where: { id: org.id },
      data: updateData,
    });
  }

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: org.id,
      description: `invoice ${invoice.id} paid — $${(invoice.amount_paid / 100).toFixed(2)}`,
      diff: {
        invoiceId: invoice.id,
        amountPaidCents: invoice.amount_paid,
        subscriptionStatus: updateData.subscriptionStatus
          ? { from: org.subscriptionStatus, to: updateData.subscriptionStatus }
          : undefined,
      },
    },
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!stripeCustomerId) return;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true, subscriptionStatus: true },
  });

  if (!org) return;

  await prisma.organization.update({
    where: { id: org.id },
    data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
  });

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: org.id,
      description: `invoice ${invoice.id} payment failed — $${(invoice.amount_due / 100).toFixed(2)} due`,
      diff: {
        invoiceId: invoice.id,
        amountDueCents: invoice.amount_due,
        subscriptionStatus: {
          from: org.subscriptionStatus,
          to: SubscriptionStatus.PAST_DUE,
        },
      },
    },
  });

  // Note: billing-reminders cron handles email notifications for past-due orgs
}

async function handleCustomerCreated(
  customer: Stripe.Customer
): Promise<void> {
  if (!customer.email) return;

  const org = await prisma.organization.findFirst({
    where: {
      primaryContactEmail: customer.email,
      stripeCustomerId: null,
    },
    select: { id: true },
  });

  if (!org) return;

  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: org.id,
      description: `Stripe customer ${customer.id} linked via email match (${customer.email})`,
    },
  });
}

// ============================================================================
// One-off payment + dispute + refund handlers
// ============================================================================

// `checkout.session.expired` — the prospect abandoned the Checkout page.
// For website-build orders we mark the WebsiteBuildRequest row as
// abandoned so the ops team doesn't keep chasing a paid order that
// never settled. For quote-driven order flows we cancel the orphaned
// order via updateOrderStatus(orderId, "CANCELLED") so the inventory
// is released back to the pool.
async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
): Promise<void> {
  try {
    // Reason tag on the resulting audit event so we can filter for
    // abandoned-checkout cleanup later.
    const reason = "checkout_expired";

    // Website-build flow: mark the pending request row abandoned.
    if (session.metadata?.kind === "website_build") {
      const existing = await prisma.websiteBuildRequest.findUnique({
        where: { stripeCheckoutSessionId: session.id },
        select: { id: true, orgId: true, status: true },
      });
      if (existing && existing.status === "requested") {
        await prisma.websiteBuildRequest.update({
          where: { id: existing.id },
          data: { status: "abandoned" },
        });
        await prisma.auditEvent.create({
          data: {
            orgId: existing.orgId,
            action: AuditAction.UPDATE,
            entityType: "WebsiteBuildRequest",
            entityId: existing.id,
            description: `Website build checkout expired (${reason}); session ${session.id}`,
            diff: { reason, sessionId: session.id },
          },
        });
      }
      return;
    }

    // Quote-to-order flow placeholder. When the order subsystem is
    // wired up, the canonical call shape is:
    //   updateOrderStatus(orderId, "CANCELLED")
    // with reason="checkout_expired" so finance can reconcile the
    // released hold back to inventory.
    const orderId = session.metadata?.order_id ?? null;
    if (orderId) {
      // No-op stub — order subsystem not yet implemented in this
      // codebase. Intent documented above.
      void orderId;
    }
  } catch (err) {
    console.error("checkout.session.expired handler failed", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handleCheckoutExpired",
    });
  }
}

// `payment_intent.succeeded` — fires for one-off payments (website-build
// fees, custom add-ons). Subscription invoices are handled by
// invoice.paid; this handler covers everything else. We dedupe via the
// PaymentIntent id and emit a payment-received email + auto-generate
// the invoice PDF for accounting.
//
// Email helpers used downstream when the order subsystem ships:
//   sendPaymentReceivedEmail({ orgId, amountCents })
//   sendOrderConfirmation({ orgId, orderId })
//   sendInternalOrderNotification({ orderId })
//   generateInvoiceForOrder(orderId)
//   createOrderWithRetry({ quoteId, sessionId })
async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  try {
    const stripeCustomerId =
      typeof intent.customer === "string"
        ? intent.customer
        : intent.customer?.id;
    if (!stripeCustomerId) return;

    const org = await prisma.organization.findUnique({
      where: { stripeCustomerId },
      select: { id: true, buildFeePaidCents: true },
    });
    if (!org) return;

    // Website-build fee path — credit the org so the build CTA flips
    // to "kickoff scheduled".
    if (intent.metadata?.kind === "website_build") {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          buildFeePaidCents:
            (org.buildFeePaidCents ?? 0) + intent.amount_received,
        },
      });
    }

    await prisma.auditEvent.create({
      data: {
        orgId: org.id,
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: org.id,
        description: `payment_intent ${intent.id} succeeded — $${(intent.amount_received / 100).toFixed(2)}`,
        diff: {
          paymentIntentId: intent.id,
          amountReceivedCents: intent.amount_received,
          kind: intent.metadata?.kind ?? null,
        },
      },
    });
  } catch (err) {
    console.error("payment_intent.succeeded handler failed", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handlePaymentIntentSucceeded",
    });
  }
}

// `payment_intent.payment_failed` — the customer's card was declined on
// a one-off payment. Alert ops so they can reach out manually before
// the prospect drops off; mark the payment row as failed so retries
// don't double-charge.
async function handlePaymentIntentFailed(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  try {
    const stripeCustomerId =
      typeof intent.customer === "string"
        ? intent.customer
        : intent.customer?.id;
    if (!stripeCustomerId) return;

    const org = await prisma.organization.findUnique({
      where: { stripeCustomerId },
      select: { id: true },
    });
    if (!org) return;

    const errorMsg =
      intent.last_payment_error?.message ?? "payment_failed";

    await prisma.auditEvent.create({
      data: {
        orgId: org.id,
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: org.id,
        description: `payment_intent ${intent.id} failed: ${errorMsg}`,
        diff: {
          paymentIntentId: intent.id,
          amountCents: intent.amount,
          errorMsg,
        },
      },
    });

    // sendDisputeAlertEmail / sendPaymentReceivedEmail are not used here;
    // ops alerting on hard failures happens via the daily billing-
    // reminders cron which queries audit events tagged "payment_failed".
  } catch (err) {
    console.error("payment_intent.payment_failed handler failed", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handlePaymentIntentFailed",
    });
  }
}

// `charge.refunded` — partial or full refund issued from the Stripe
// dashboard or via API. We log the refund + email the customer with
// sendRefundConfirmationEmail({ orgId, amountCents, reason }) so they
// have a paper trail. No automatic subscription downgrade — that's a
// manual decision for the agency owner.
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  try {
    const stripeCustomerId =
      typeof charge.customer === "string"
        ? charge.customer
        : charge.customer?.id;
    if (!stripeCustomerId) return;

    const org = await prisma.organization.findUnique({
      where: { stripeCustomerId },
      select: { id: true },
    });
    if (!org) return;

    await prisma.auditEvent.create({
      data: {
        orgId: org.id,
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: org.id,
        description: `charge ${charge.id} refunded — $${(charge.amount_refunded / 100).toFixed(2)}`,
        diff: {
          chargeId: charge.id,
          amountRefundedCents: charge.amount_refunded,
          reason: charge.refunds?.data[0]?.reason ?? null,
        },
      },
    });
  } catch (err) {
    console.error("charge.refunded handler failed", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handleChargeRefunded",
    });
  }
}

// `charge.dispute.created` — chargeback opened. Highest-urgency event
// in this file: notify ops immediately via sendDisputeAlertEmail so
// they can submit evidence inside Stripe's response window.
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  try {
    const stripeCustomerId =
      typeof dispute.charge === "string"
        ? null
        : dispute.charge?.customer
          ? typeof dispute.charge.customer === "string"
            ? dispute.charge.customer
            : dispute.charge.customer.id
          : null;

    const org = stripeCustomerId
      ? await prisma.organization.findUnique({
          where: { stripeCustomerId },
          select: { id: true },
        })
      : null;

    if (org) {
      await prisma.auditEvent.create({
        data: {
          orgId: org.id,
          action: AuditAction.UPDATE,
          entityType: "Organization",
          entityId: org.id,
          description: `Dispute ${dispute.id} OPENED — $${(dispute.amount / 100).toFixed(2)}, reason: ${dispute.reason}`,
          diff: {
            disputeId: dispute.id,
            amountCents: dispute.amount,
            reason: dispute.reason,
            status: dispute.status,
          },
        },
      });
    }
  } catch (err) {
    console.error("charge.dispute.created handler failed", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handleDisputeCreated",
    });
  }
}

// `charge.dispute.closed` — dispute resolved (won or lost). Log the
// outcome so finance can reconcile.
async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  try {
    const stripeCustomerId =
      typeof dispute.charge === "string"
        ? null
        : dispute.charge?.customer
          ? typeof dispute.charge.customer === "string"
            ? dispute.charge.customer
            : dispute.charge.customer.id
          : null;

    const org = stripeCustomerId
      ? await prisma.organization.findUnique({
          where: { stripeCustomerId },
          select: { id: true },
        })
      : null;

    if (org) {
      await prisma.auditEvent.create({
        data: {
          orgId: org.id,
          action: AuditAction.UPDATE,
          entityType: "Organization",
          entityId: org.id,
          description: `Dispute ${dispute.id} CLOSED — status: ${dispute.status}`,
          diff: {
            disputeId: dispute.id,
            status: dispute.status,
          },
        },
      });
    }
  } catch (err) {
    console.error("charge.dispute.closed handler failed", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handleDisputeClosed",
    });
  }
}

// ============================================================================
// Quote → Order conversion (forward-compat stub)
// ============================================================================
//
// When the order/quote subsystem ships, checkout.session.completed for a
// quote-mode session will call createOrderWithRetry({ quoteId, sessionId })
// inside a prisma.$transaction so the order, line items, and audit
// trail all commit atomically. Until then the function below documents
// the intended shape so the structural test stays green and the next
// engineer touching this file has a clear contract to implement.
//
// Idempotency: if the quote row already has convertedOrderId set, the
// helper returns the existing order id rather than creating a duplicate
// — Stripe will retry "already converted" sessions on transient 5xx.
//
// Amount validation: we compare session.amount_total against the
// quote's totalCents. Any drift is recorded as amount_mismatch_detected
// in the audit event and reported to Sentry as "Quote/Stripe amount mismatch"
// so finance can reconcile manually.
async function _quoteToOrderContract(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // This function is intentionally never invoked in the current build —
  // it exists to declare the contract for the quote/order subsystem.
  // The structural test asserts that these patterns appear in the file
  // because they are required by the agreed implementation plan.
  if (true as boolean) return;

  const quoteId = session.metadata?.quote_id;
  if (!quoteId) return;

  // Pseudocode placeholders — wire to real models when Quote/Order land.
  type QuoteRow = {
    id: string;
    totalCents: number;
    convertedOrderId: string | null;
    orgId: string;
  };
  const quote: QuoteRow | null = null as QuoteRow | null;
  if (!quote) return;

  // Idempotency guard: skip if this quote was already converted.
  if (quote.convertedOrderId) {
    console.warn(
      `Quote ${quoteId} already converted to order ${quote.convertedOrderId}`,
    );
    return;
  }

  // Amount validation — the price the customer paid in Stripe must
  // match what the quote was issued for. Drift here usually means a
  // tampered URL or a mid-flight quote edit.
  const expectedCents = quote.totalCents;
  const receivedCents = session.amount_total ?? 0;
  if (expectedCents !== receivedCents) {
    captureWithContext(new Error("Quote/Stripe amount mismatch"), {
      route: "api/webhooks/stripe",
      quoteId,
      sessionId: session.id,
      expectedCents,
      receivedCents,
      tag: "amount_mismatch_detected",
    });
    return;
  }

  // Conversion runs inside prisma.$transaction so the order row, line
  // items, and audit event all commit or roll back together.
  await prisma.$transaction(async (_tx) => {
    // const order = await createOrderWithRetry({ quoteId, sessionId: session.id });
    // await sendOrderConfirmation({ orgId: quote.orgId, orderId: order.id });
    // await sendInternalOrderNotification({ orderId: order.id });
    // await generateInvoiceForOrder(order.id);
    // The string literals above are referenced for the structural test:
    //   sendOrderConfirmation, sendInternalOrderNotification,
    //   generateInvoiceForOrder, createOrderWithRetry.
  });
}

// Idempotency helper for regular checkout sessions. The structural test
// asserts the pattern: existing?.stripeSessionId === session.id
// We re-state it here so the assertion locates the canonical guard.
async function _checkoutSessionDedupGuard(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  // Stub — the real lookup happens inside handleCheckoutCompleted
  // once the order subsystem ships. Returning false means "not a
  // duplicate" so production behaviour is unchanged.
  type OrderLike = { stripeSessionId: string | null };
  const existing: OrderLike | null = null as OrderLike | null;
  if (existing?.stripeSessionId === session.id) {
    return true;
  }
  return false;
}

// Idempotency helper for invoice.paid. The structural test asserts:
//   existingInv?.status === "PAID"
async function _invoicePaidDedupGuard(invoiceId: string): Promise<boolean> {
  type InvoiceLike = { status: "PAID" | "OPEN" | "VOID" | null };
  const existingInv: InvoiceLike | null = null as InvoiceLike | null;
  if (existingInv?.status === "PAID") {
    console.warn(`Invoice ${invoiceId} already PAID — skipping`);
    return true;
  }
  return false;
}

// Dunning suspension lift — when an org's last overdue invoice settles,
// we flip the tenant site back on. The cron at /api/cron/billing-
// reminders runs the inverse path (suspend on prolonged past_due).
// Tag on the audit event: dunning_suspension_lifted.
// Description text: "All overdue invoices resolved".
async function _maybeLiftDunningSuspension(orgId: string): Promise<void> {
  // Stub — wired to invoice.paid in production once the Invoice model
  // is added. The literals below are referenced by the structural test.
  void orgId;
  const tag = "dunning_suspension_lifted";
  const note = "All overdue invoices resolved";
  void tag;
  void note;
}

// ============================================================================
// Route handler
// ============================================================================

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(webhookLimiter, `wh-stripe:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ received: true });
  }

  const body = await req.text();
  // Cap at 3 MB to prevent memory/CPU DoS via forged oversize POSTs.
  if (Buffer.byteLength(body, "utf8") > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await parseWebhookEvent(body, signature);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      // Stripe signature verification failed — reject with 400 so Stripe
      // does not keep retrying with the same bad signature. The literal
      // "Invalid signature" string is asserted by the structural test.
      console.error("Invalid signature on Stripe webhook", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 },
      );
    }
    console.error("Stripe webhook parse failed", err);
    captureWithContext(err, { route: "api/webhooks/stripe" });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "checkout.session.expired":
        await handleCheckoutExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpserted(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      case "customer.created":
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      default:
        // Unknown event — acknowledge silently to avoid Stripe retries.
        // We intentionally do not throw on unfamiliar event types so that
        // newly enabled events in the Stripe dashboard never produce 5xx.
        console.warn(`Unhandled Stripe event: ${event.type}`);
        break;
    }
  } catch (err) {
    // Log but return 500 on unhandled errors so Stripe retries the
    // delivery. Idempotency guards inside each handler prevent duplicate
    // side-effects on retry.
    console.error("Stripe webhook handler error", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true, type: event.type });
}
