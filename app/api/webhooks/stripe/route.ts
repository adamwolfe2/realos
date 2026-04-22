import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { captureWithContext } from "@/lib/sentry";
import { isStripeConfigured, parseWebhookEvent } from "@/lib/stripe/config";
import { WebhookSignatureError } from "@/lib/stripe/errors";
import { webhookLimiter, checkRateLimit, getIp, rateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import {
  SubscriptionStatus,
  SubscriptionTier,
  TenantStatus,
  AuditAction,
} from "@prisma/client";

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
    select: { id: true, subscriptionStatus: true, subscriptionTier: true },
  });

  if (!org) {
    // No org linked yet — nothing to update
    return;
  }

  const newStatus = toSubscriptionStatus(subscription.status);
  const newTier = toSubscriptionTier(
    subscription.items.data[0]?.price?.metadata
  );

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

  await prisma.organization.update({
    where: { id: org.id },
    data: updateData,
  });

  const oldStatus = org.subscriptionStatus ?? "none";
  const descParts = [`subscription ${subscription.id}`, `status: ${oldStatus} → ${newStatus ?? "unchanged"}`];
  if (newTier) descParts.push(`tier: ${newTier}`);

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: org.id,
      description: descParts.join(", "),
      diff: {
        subscriptionStatus: { from: oldStatus, to: newStatus },
        subscriptionTier: newTier ? { from: org.subscriptionTier, to: newTier } : undefined,
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

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: SubscriptionStatus.CANCELED,
      status: TenantStatus.CHURNED,
    },
  });

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: org.id,
      description: `subscription ${subscription.id} deleted — org marked CHURNED`,
      diff: {
        subscriptionStatus: {
          from: org.subscriptionStatus,
          to: SubscriptionStatus.CANCELED,
        },
        status: { from: undefined, to: TenantStatus.CHURNED },
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
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await parseWebhookEvent(body, signature);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    captureWithContext(err, { route: "api/webhooks/stripe" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  try {
    switch (event.type) {
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
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.created":
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      default:
        // Unknown event — acknowledge silently to avoid Stripe retries
        break;
    }
  } catch (err) {
    // Log but return 200 — returning non-2xx causes Stripe to retry, which
    // can produce duplicate side-effects on a subsequent successful run.
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      eventId: event.id,
      eventType: event.type,
    });
  }

  return NextResponse.json({ received: true, type: event.type });
}
