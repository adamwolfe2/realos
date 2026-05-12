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
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    captureWithContext(err, { route: "api/webhooks/stripe" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
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
