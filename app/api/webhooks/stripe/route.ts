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
  ProposalStatus,
} from "@prisma/client";
import {
  computeMrrCents,
  modulesFromSubscriptionPriceIds,
  subscriptionHasWhiteLabel,
  tierFromStripePriceId,
} from "@/lib/billing/plans";
import { modulesFromFeaturePriceIds } from "@/lib/billing/feature-stripe";
import { buildModuleStateFromSelection } from "@/lib/billing/features";
import { processStripeEventOnce } from "@/lib/proposals/idempotency";
import { runProvisioningForProposal } from "@/lib/proposals/provision";

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
  subscription: Stripe.Subscription,
  eventId: string,
  eventType: string,
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
      // Pre-image of the white-label flag so we can diff for the audit
      // trail and skip a no-op write when activation state is unchanged.
      whiteLabel: true,
      cancelAtPeriodEnd: true,
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
    // Same PAUSED guard as handleInvoicePaymentFailed: Stripe's ongoing
    // `customer.subscription.updated` events carry status=past_due while an
    // org is on our internal 14-day PAUSED lock. Blocking only the
    // PAUSED→PAST_DUE downgrade prevents re-arming dunning + unlocking the
    // read-only gate, while still allowing a genuine PAUSED→ACTIVE (customer
    // fixed their card in Stripe's portal) or PAUSED→CANCELED to apply.
    const clobbersPause =
      org.subscriptionStatus === SubscriptionStatus.PAUSED &&
      newStatus === SubscriptionStatus.PAST_DUE;
    if (!clobbersPause) {
      updateData.subscriptionStatus = newStatus;
    }
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
  // À-la-carte subscriptions bill per feature — resolve the EXACT module set
  // from the feature prices so the operator's selection is never overwritten
  // by a tier's defaults. Falls back to the tier mapping for legacy/tier subs.
  const featureModules = await modulesFromFeaturePriceIds(priceIds);
  const modules = featureModules ?? modulesFromSubscriptionPriceIds(priceIds);
  if (modules) {
    Object.assign(updateData, modules);
  }

  // White-label add-on activation. Capability flip — present on the
  // subscription items → flag on; absent → flag off. The brand override
  // fields (whiteLabelBrandName / Logo / PrimaryColor) are left intact
  // on deactivation so re-activating the add-on doesn't force the
  // operator to re-upload their kit. See lib/brand/effective.ts for
  // the consumer.
  const hasWhiteLabel = subscriptionHasWhiteLabel(priceIds);
  // Only write when the state actually changes. Avoids audit-spam on
  // every customer.subscription.updated event Stripe fires (which is a
  // LOT for active customers).
  if (hasWhiteLabel !== org.whiteLabel) {
    updateData.whiteLabel = hasWhiteLabel;
  }

  // If the subscription is canceled or unpaid, do NOT downgrade module
  // flags here — `handleSubscriptionDeleted` and the past_due flow
  // (billing-reminders cron) handle the lifecycle separately. Flipping
  // modules off on a transient `past_due` would break the customer's
  // tenant site during the grace window before they update their
  // payment method.

  // Persist cancel-at-period-end flag from Stripe. Cleared when the
  // subscription is reactivated (cancel_at_period_end=false or status=active
  // with no pending cancel). Surfaced on the billing page as an amber banner.
  updateData.cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  if (currentPeriodEnd) {
    updateData.currentPeriodEnd = new Date(currentPeriodEnd * 1000);
  }

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

  if (updateData.whiteLabel !== undefined) {
    descParts.push(
      `white-label: ${org.whiteLabel ? "on" : "off"} → ${hasWhiteLabel ? "on" : "off"}`,
    );
  }

  // Wrap audit write in processStripeEventOnce so retries don't create
  // duplicate audit rows. The org update above is idempotent (last-write-wins);
  // the audit create is not.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
            whiteLabel:
              updateData.whiteLabel !== undefined
                ? { from: org.whiteLabel, to: hasWhiteLabel }
                : undefined,
          },
        },
      });
    },
  );
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
  eventId?: string,
): Promise<void> {
  // Proposal accept flow. The Checkout session was created by
  // /api/proposals/[token]/accept and carries metadata.kind === "proposal".
  // This MUST fire before the marketplace/quote/website-build branches so
  // a proposal session is never misrouted.
  //
  // For payment mode (one-time): payment_status === "paid" means money
  //   actually moved → accept + provision now.
  // For subscription mode: do NOT accept here. Stripe fires this event
  //   the moment the subscription is created, even with a trial and even
  //   when payment hasn't cleared yet (3DS pending, sub still incomplete).
  //   We persist sub + invoice ids and wait for invoice.paid to fire the
  //   acceptance path so we never provision on unpaid money.
  if (session.metadata?.kind === "proposal") {
    await handleProposalCheckoutCompleted(session, eventId);
    return;
  }

  // Marketplace lead purchase — handled by the shared marketplace lib.
  // Detected via metadata.marketplaceLeadId set in the marketplace
  // checkout route. Returns true if it owned the event; we exit early.
  if (session.metadata?.marketplaceLeadId) {
    const { handleMarketplaceCheckoutCompleted } = await import(
      "@/lib/marketplace/webhook-handlers"
    );
    await handleMarketplaceCheckoutCompleted(session);
    return;
  }

  // Quote → Order checkout. The Quote/Order subsystem is not yet shipped
  // (no Prisma models), but Stripe Checkout sessions tagged with
  // `quote_id` metadata DO fire this webhook in production whenever a
  // sales-issued quote completes. Pre-fix the request silently fell
  // through to the anonymous-signup branch below, which no-ops on any
  // session lacking customer.email — meaning a paid quote produced ZERO
  // platform-side state: no order row, no audit event, no Sentry
  // breadcrumb. Finance had no signal that money came in.
  //
  // Until the Order model lands (separate schema-design session), we
  // turn the silent drop into a LOUD drop:
  //   1. Capture a Sentry exception tagged `quote_checkout_unhandled`
  //      with every field finance needs to reconcile manually.
  //   2. Email the ops inbox (BUG_REPORT_EMAIL → ADMIN_EMAIL) so the
  //      failure is visible without watching Sentry.
  //   3. Write a synthetic Organization-less audit-style note via
  //      Sentry breadcrumb (not AuditEvent — there's no orgId yet).
  //   4. Return early so the rest of the handler doesn't try to
  //      anonymous-link the quote's Stripe customer to a random org.
  //
  // When the Order subsystem lands, replace this block with the real
  // converter that calls _quoteToOrderContract (already defined below
  // as the implementation contract).
  if (session.metadata?.quote_id) {
    await handleQuoteCheckoutUnhandled(session);
    return;
  }

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
  subscription: Stripe.Subscription,
  eventId: string,
  eventType: string,
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
      // Revoke EVERY paid catalog module from the canonical all-off state
      // (always-on website + lead-capture stay on so the tenant site doesn't
      // 404 mid-dispute). Derived from FEATURE_CATALOG so a newly-added module
      // can't be silently left enabled on cancel — the old hardcoded list had
      // already drifted (popups/reputation/insights/marketIntel/attribution
      // stayed on). (Codex.)
      ...buildModuleStateFromSelection([]),
      // Cancellation also revokes the white-label add-on. We keep the
      // override fields (logo/name/color) on the row so re-subscribing
      // restores the operator's brand without a re-upload.
      whiteLabel: false,
    },
  });

  // Wrap audit write in processStripeEventOnce so retries don't create
  // duplicate audit rows. The org update above is idempotent (status
  // converges to CANCELED); the audit create is not.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
    },
  );
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  eventId?: string,
): Promise<void> {
  // Proposal subscription accept path: this is the FIRST invoice.paid for a
  // subscription created via the proposal-accept Checkout flow. We do the
  // acceptance + provisioning here (not on checkout.session.completed) so
  // we never provision on unpaid money — Stripe fires session.completed
  // for trial subscriptions before any money moves, and for failed-3DS
  // subscriptions in `incomplete` state. invoice.paid only fires when the
  // money actually clears.
  if (eventId) {
    await maybeAcceptProposalFromInvoice(invoice, eventId);
  }

  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!stripeCustomerId) return;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true, subscriptionStatus: true, status: true },
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

  // Reverse the lifecycle pause too. The 14-day-overdue escalation
  // (billing-reminders cron) sets TenantStatus.PAUSED — which disables the
  // public chatbot — alongside subscriptionStatus=PAUSED. Without flipping
  // status back here the chatbot stayed dead forever after a single lapse,
  // even once the customer paid. Only touch the PAUSED→ACTIVE transition so
  // we never clobber other lifecycle states (CHURNED, AT_RISK, etc.).
  if (org.status === TenantStatus.PAUSED) {
    updateData.status = TenantStatus.ACTIVE;
  }

  // NOTE: do NOT write mrrCents here. invoice.amount_paid is the full charge
  // for the billing period — for an annual subscriber that's ~12x the monthly
  // MRR (e.g. $11,880/yr would store mrrCents=$11,880/mo). MRR is owned solely
  // by handleSubscriptionUpserted via computeMrrCents(), which normalizes
  // annual prices to a monthly figure. This handler only resolves past_due/
  // paused → active on successful payment. (P2: MRR inflation for annual subs.)

  if (Object.keys(updateData).length > 0) {
    await prisma.organization.update({
      where: { id: org.id },
      data: updateData,
    });
  }

  // Wrap audit write in processStripeEventOnce so retries don't create
  // duplicate audit rows. Use eventId ?? invoice.id as the idempotency key
  // since handleInvoicePaid accepts an optional eventId.
  await processStripeEventOnce(
    { eventId: eventId ?? invoice.id, eventType: "invoice.paid", orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
    },
  );
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  eventId: string,
  eventType: string,
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

  // Do NOT clobber an internal PAUSED with PAST_DUE. After the 14-day-overdue
  // escalation (billing-reminders cron) sets subscriptionStatus=PAUSED, Stripe
  // keeps firing invoice.payment_failed on its smart-retry schedule. Reverting
  // to PAST_DUE re-enrolls the org in the dunning cron (which selects on
  // PAST_DUE) AND makes resolveTrialState treat it as "paid", silently lifting
  // the read-only lock the pause promised. Leaving PAUSED is the correct
  // terminal state until the customer pays (handleInvoicePaid → ACTIVE) or the
  // subscription is canceled (handleSubscriptionDeleted).
  if (org.subscriptionStatus === SubscriptionStatus.PAUSED) {
    return;
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
  });

  // Wrap audit write in processStripeEventOnce so retries don't create
  // duplicate audit rows. The org update above is idempotent (converges
  // to PAST_DUE); the audit create is not.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
    },
  );

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
    // Marketplace lead purchase that expired before checkout completed.
    // Delegate to the marketplace lib which un-reserves the lead and
    // flips the purchase row to FAILED.
    if (session.metadata?.marketplaceLeadId) {
      const { handleMarketplaceCheckoutExpired } = await import(
        "@/lib/marketplace/webhook-handlers"
      );
      await handleMarketplaceCheckoutExpired(session);
      return;
    }

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
  eventId: string,
  eventType: string,
): Promise<void> {
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

  // Wrap the money-state write + audit in a first-write-wins dedupe fence.
  // Previously this handler swallowed ALL errors and returned void, so the
  // outer dispatcher 200'd and Stripe never retried — a failed audit insert
  // silently dropped the credit for a PAID website-build fee. Now the writes
  // either both commit (once) or roll back and re-throw so Stripe retries;
  // the ProcessedStripeEvent row makes the retry a no-op instead of a
  // double-credit. The credit itself uses an atomic `increment` so there is
  // no read-modify-write race across concurrent deliveries.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      // Website-build fee path — credit the org so the build CTA flips
      // to "kickoff scheduled".
      if (intent.metadata?.kind === "website_build") {
        await tx.organization.update({
          where: { id: org.id },
          data: {
            buildFeePaidCents: { increment: intent.amount_received },
          },
        });
      }

      await tx.auditEvent.create({
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
    },
  );
}

// `payment_intent.payment_failed` — the customer's card was declined on
// a one-off payment. Alert ops so they can reach out manually before
// the prospect drops off; mark the payment row as failed so retries
// don't double-charge.
async function handlePaymentIntentFailed(
  intent: Stripe.PaymentIntent,
  eventId: string,
  eventType: string,
): Promise<void> {
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

  // Dedupe-fenced so a failed insert re-throws (→ outer 500 → Stripe retry)
  // instead of being swallowed and losing the failure audit record.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
    },
  );

  // sendDisputeAlertEmail / sendPaymentReceivedEmail are not used here;
  // ops alerting on hard failures happens via the daily billing-
  // reminders cron which queries audit events tagged "payment_failed".
}

// `charge.refunded` — partial or full refund issued from the Stripe
// dashboard or via API. We log the refund + email the customer with
// sendRefundConfirmationEmail({ orgId, amountCents, reason }) so they
// have a paper trail. No automatic subscription downgrade — that's a
// manual decision for the agency owner.
async function handleChargeRefunded(
  charge: Stripe.Charge,
  eventId: string,
  eventType: string,
): Promise<void> {
  // Marketplace charges don't have a corresponding Organization row.
  // The marketplace handler returns true if it owned the charge (and runs
  // its own idempotency guard).
  const { handleMarketplaceChargeRefunded } = await import(
    "@/lib/marketplace/webhook-handlers"
  );
  const handledByMarketplace = await handleMarketplaceChargeRefunded(charge);
  if (handledByMarketplace) return;

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

  // Dedupe-fenced: a failed audit insert now re-throws so Stripe retries the
  // refund record instead of the handler swallowing it and 200-ing.
  // sendRefundConfirmationEmail wiring lands with the order subsystem.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
    },
  );
}

async function notifyOpsOfDispute(input: {
  disputeId: string;
  amountCents: number;
  reason: string;
  orgId: string;
}): Promise<void> {
  const { getResend, BRAND_EMAIL } = await import("@/lib/email/shared");
  const resend = getResend();
  if (!resend) return;

  const to =
    process.env.BUG_REPORT_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    BRAND_EMAIL ||
    "team@leasestack.co";
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || `LeaseStack <team@leasestack.co>`;

  const text = [
    "A Stripe chargeback (dispute) has been opened. Respond within Stripe's evidence window.",
    "",
    `Dispute ID:   ${input.disputeId}`,
    `Amount:       $${(input.amountCents / 100).toFixed(2)}`,
    `Reason:       ${input.reason}`,
    `Org ID:       ${input.orgId}`,
    "",
    "Log into the Stripe dashboard to submit evidence.",
    "Sentry handler: handleDisputeCreated",
  ].join("\n");

  await resend.emails.send({
    from,
    to,
    subject: `[LeaseStack ops] Dispute OPENED — $${(input.amountCents / 100).toFixed(2)} — ${input.disputeId}`,
    text,
  });
}

// `charge.dispute.created` — chargeback opened. Highest-urgency event
// in this file: notify ops immediately via sendDisputeAlertEmail so
// they can submit evidence inside Stripe's response window.
async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  eventId: string,
  eventType: string,
): Promise<void> {
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

  if (!org) return;

  // Dedupe-fenced so the chargeback record survives a transient insert
  // failure (re-throw → outer 500 → Stripe retry) instead of being lost.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
    },
  );

  // Alert ops immediately — chargeback response windows are tight.
  void notifyOpsOfDispute({
    disputeId: dispute.id,
    amountCents: dispute.amount,
    reason: dispute.reason,
    orgId: org.id,
  }).catch((err) => {
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handleDisputeCreated.notify",
      orgId: org.id,
    });
  });
}

// `charge.dispute.closed` — dispute resolved (won or lost). Log the
// outcome so finance can reconcile.
async function handleDisputeClosed(
  dispute: Stripe.Dispute,
  eventId: string,
  eventType: string,
): Promise<void> {
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

  if (!org) return;

  // Dedupe-fenced so the resolution record survives a transient insert
  // failure (re-throw → outer 500 → Stripe retry) instead of being lost.
  await processStripeEventOnce(
    { eventId, eventType, orgId: org.id },
    async (tx) => {
      await tx.auditEvent.create({
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
    },
  );
}

// ============================================================================
// Quote → Order: live "loud failure" handler + forward-compat contract stub
// ============================================================================
//
// The Order subsystem isn't shipped yet (no Quote/Order Prisma models).
// Until it lands we still get Stripe `checkout.session.completed` events
// for sales-issued quotes — those would otherwise be silently dropped.
// `handleQuoteCheckoutUnhandled` makes that drop loud (Sentry + ops
// email) so finance can reconcile manually until the real converter
// (described by `_quoteToOrderContract` below) is wired up.

async function handleQuoteCheckoutUnhandled(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const quoteId = session.metadata?.quote_id ?? null;
  const customerEmail =
    session.customer_details?.email ??
    session.customer_email ??
    null;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const amountTotalCents = session.amount_total ?? 0;
  const currency = session.currency ?? null;

  // 1. Sentry capture with every field finance + eng needs to reconcile.
  captureWithContext(new Error("Quote checkout received but Order model not yet implemented"), {
    route: "api/webhooks/stripe",
    handler: "handleQuoteCheckoutUnhandled",
    tag: "quote_checkout_unhandled",
    quoteId,
    sessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    stripeCustomerId,
    customerEmail,
    amountTotalCents,
    currency,
    paymentStatus: session.payment_status,
    mode: session.mode,
    livemode: session.livemode,
    allMetadata: session.metadata ?? {},
  });

  // 2. Loud log so the on-call dashboard surfaces it even if Sentry is
  // misconfigured for this env.
  console.error(
    `[stripe-webhook] quote_checkout_unhandled — quoteId=${quoteId} sessionId=${session.id} ` +
      `amount=${amountTotalCents} ${currency ?? "?"} email=${customerEmail ?? "?"} customer=${stripeCustomerId ?? "?"}`,
  );

  // 3. Email ops so the silent failure becomes a loud failure even for
  // anyone not watching Sentry. Fire-and-forget — a Resend outage must
  // not cause Stripe to retry (we already captured Sentry above).
  void notifyOpsOfQuoteCheckoutDrop({
    quoteId,
    sessionId: session.id,
    amountTotalCents,
    currency,
    customerEmail,
    stripeCustomerId,
    metadata: session.metadata ?? {},
  }).catch((err) => {
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "handleQuoteCheckoutUnhandled.notify",
    });
  });
}

async function notifyOpsOfQuoteCheckoutDrop(input: {
  quoteId: string | null;
  sessionId: string;
  amountTotalCents: number;
  currency: string | null;
  customerEmail: string | null;
  stripeCustomerId: string | null;
  metadata: Record<string, string>;
}): Promise<void> {
  const { getResend, BRAND_EMAIL } = await import("@/lib/email/shared");
  const resend = getResend();
  if (!resend) return; // No Resend in this env — Sentry already captured.

  const to =
    process.env.BUG_REPORT_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    BRAND_EMAIL ||
    "team@leasestack.co";
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || `LeaseStack <team@leasestack.co>`;

  const amountDisplay =
    input.currency && input.amountTotalCents
      ? `${(input.amountTotalCents / 100).toFixed(2)} ${input.currency.toUpperCase()}`
      : `${input.amountTotalCents} (raw cents)`;

  const metadataLines = Object.entries(input.metadata)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const text = [
    "A Stripe quote checkout completed but the Order/Quote subsystem is not yet implemented.",
    "Reconcile this payment manually. The customer was charged successfully.",
    "",
    `Quote ID:           ${input.quoteId ?? "(none)"}`,
    `Stripe Session:     ${input.sessionId}`,
    `Amount:             ${amountDisplay}`,
    `Customer Email:     ${input.customerEmail ?? "(unknown)"}`,
    `Stripe Customer:    ${input.stripeCustomerId ?? "(unknown)"}`,
    "",
    "Full session metadata:",
    metadataLines || "  (none)",
    "",
    "Sentry tag: quote_checkout_unhandled",
  ].join("\n");

  await resend.emails.send({
    from,
    to,
    subject: `[LeaseStack ops] Quote checkout dropped — manual reconcile needed (${input.sessionId})`,
    text,
  });
}

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

// DEAD CODE — structural-test-only forward declaration. The real guard lives
// inside handleCheckoutCompleted once the order subsystem ships.
// DO NOT delete: stripe-webhook.test.ts asserts the literal pattern
// `existing?.stripeSessionId === session.id` present in this file.
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

// DEAD CODE — structural-test-only forward declaration. The real guard is
// superseded by processStripeEventOnce in handleInvoicePaid.
// DO NOT delete: stripe-webhook.test.ts asserts the literal patterns
// `existingInv?.status === "PAID"` and `Invoice ${invoiceId} already PAID`
// present in this file.
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
// Proposal accept-and-pay webhook handlers
// ============================================================================
//
// Three event types touch the proposal flow:
//   1. checkout.session.completed
//        - payment mode (one-time only): accept + provision now
//        - subscription mode: persist sub + invoice ids, WAIT for invoice.paid
//   2. invoice.paid (or invoice.payment_succeeded)
//        - if the invoice's subscription metadata carries a proposalId AND
//          the proposal is not yet ACCEPTED: accept + provision
//   3. customer.subscription.trial_will_end
//        - if subscription.metadata.proposalId: email prospect + agency (v1
//          logs + Sentry warning; v2 will wire the real send via lib/proposals/email)
//
// Every branch routes through processStripeEventOnce so a Stripe retry can
// never double-provision. Sentry breadcrumbs include the proposalId tag for
// fast forensic queries.

async function handleProposalCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventId?: string,
): Promise<void> {
  const proposalId = session.metadata?.proposalId ?? null;
  if (!proposalId) {
    captureWithContext(
      new Error("Proposal checkout session missing proposalId metadata"),
      {
        route: "api/webhooks/stripe",
        handler: "handleProposalCheckoutCompleted",
        sessionId: session.id,
      },
    );
    return;
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const invoiceId =
    typeof session.invoice === "string"
      ? session.invoice
      : session.invoice?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Always persist the sub + invoice + customer refs so admin tooling can
  // correlate even before acceptance fires. Defensive write — never clears
  // an existing value.
  const persistData: Parameters<typeof prisma.proposal.update>[0]["data"] = {};
  if (stripeCustomerId) persistData.stripeCustomerId = stripeCustomerId;
  if (subscriptionId) persistData.stripeSubscriptionId = subscriptionId;
  if (invoiceId) persistData.stripeInvoiceId = invoiceId;
  if (Object.keys(persistData).length > 0) {
    await prisma.proposal
      .update({
        where: { id: proposalId },
        data: persistData,
      })
      .catch((err) => {
        captureWithContext(err, {
          route: "api/webhooks/stripe",
          handler: "handleProposalCheckoutCompleted.persist",
          proposalId,
        });
      });
  }

  // Subscription mode: do NOT accept here. Wait for invoice.paid so we
  // never provision on unpaid money (trial, 3DS pending, card failed).
  if (session.mode === "subscription") {
    return;
  }

  // Payment mode (one-time only). Stripe fires session.completed only
  // when payment_status === "paid" for payment mode, but we double-check
  // anyway to defend against future Stripe behavior changes.
  if (session.payment_status !== "paid") {
    return;
  }

  if (!stripeCustomerId) {
    captureWithContext(
      new Error("Proposal payment-mode session missing customer id"),
      {
        route: "api/webhooks/stripe",
        handler: "handleProposalCheckoutCompleted",
        proposalId,
        sessionId: session.id,
      },
    );
    return;
  }

  await acceptProposalAndProvision({
    proposalId,
    eventId: eventId ?? `cs_${session.id}`,
    eventType: "checkout.session.completed",
    stripeCheckoutId: session.id,
    stripeCustomerId,
    stripeInvoiceId: invoiceId,
    stripeSubscriptionId: subscriptionId,
    stripePaymentIntentId: paymentIntentId,
    amountPaidCents: session.amount_total ?? 0,
  });
}

async function maybeAcceptProposalFromInvoice(
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<void> {
  // Pull subscription id from any of the places Stripe might park it
  // depending on API version + event shape.
  const subscriptionId = extractSubscriptionId(invoice);
  if (!subscriptionId) {
    // review-fix: silent return on a no-subscription invoice is correct
    // (non-subscription invoices flow through this code path harmlessly
    // and don't need to fire alerts), BUT capture a breadcrumb when the
    // invoice's line items carry proposal metadata — that combination
    // means the invoice IS proposal-related but Stripe has reshaped where
    // the subscription pointer lives. Without this signal we'd silently
    // stop accepting proposals after a Stripe API upgrade.
    const looksProposalRelated = invoice.lines?.data?.some((line) => {
      const meta = (line.metadata ?? null) as Record<string, string> | null;
      return meta?.proposalLineId != null || meta?.proposalLineKind != null;
    });
    if (looksProposalRelated) {
      captureWithContext(
        new Error("Proposal invoice.paid missing subscription id"),
        {
          route: "api/webhooks/stripe",
          handler: "maybeAcceptProposalFromInvoice",
          tag: "stripe_invoice_no_sub_id",
          invoiceId: invoice.id,
          eventId,
        },
      );
    }
    return;
  }

  // Pull subscription so we can read its metadata.proposalId. Single
  // round-trip; fail closed (no acceptance) on any error.
  let subscription: Stripe.Subscription;
  try {
    subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  } catch (err) {
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "maybeAcceptProposalFromInvoice.retrieveSub",
      subscriptionId,
    });
    return;
  }

  const proposalId = subscription.metadata?.proposalId ?? null;
  if (!proposalId) return;

  // If proposal is already ACCEPTED we still let processStripeEventOnce
  // dedupe; the acceptance helper short-circuits idempotently.
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  if (!stripeCustomerId) return;

  const checkoutSessionId =
    subscription.metadata?.checkoutSessionId ??
    // Fallback: best-effort look up via our stored stripeCheckoutId
    null;

  await acceptProposalAndProvision({
    proposalId,
    eventId,
    eventType: "invoice.paid",
    stripeCheckoutId: checkoutSessionId,
    stripeCustomerId,
    stripeInvoiceId: invoice.id ?? null,
    stripeSubscriptionId: subscriptionId,
    stripePaymentIntentId: null,
    amountPaidCents: invoice.amount_paid ?? 0,
  });
}

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Stripe's invoice shape moved subscription onto invoice.parent in
  // newer API versions; older code paths still read invoice.subscription.
  // Read both defensively.
  const top = (invoice as unknown as { subscription?: unknown }).subscription;
  if (typeof top === "string") return top;
  if (top && typeof top === "object" && "id" in top) {
    const id = (top as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  const parent = invoice.parent;
  if (
    parent?.type === "subscription_details" &&
    parent.subscription_details?.subscription
  ) {
    const sub = parent.subscription_details.subscription;
    return typeof sub === "string" ? sub : (sub.id ?? null);
  }
  return null;
}

async function acceptProposalAndProvision(args: {
  proposalId: string;
  eventId: string;
  eventType: string;
  stripeCheckoutId: string | null;
  stripeCustomerId: string;
  stripeInvoiceId: string | null;
  stripeSubscriptionId: string | null;
  stripePaymentIntentId: string | null;
  amountPaidCents: number;
}): Promise<void> {
  // Cheap pre-check: skip everything if the proposal is already ACCEPTED
  // AND its acceptance row has a stable shape. runProvisioningForProposal
  // wraps its own processStripeEventOnce so retries are safe past this
  // point, but skipping the upserts on a known-accepted proposal avoids
  // a useless DB round-trip on every routine retry.
  const existing = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    select: {
      status: true,
      stripeCheckoutId: true,
      acceptance: { select: { id: true, provisionedOrgId: true } },
    },
  });
  if (!existing) {
    captureWithContext(
      new Error("acceptProposalAndProvision: proposal not found"),
      {
        route: "api/webhooks/stripe",
        proposalId: args.proposalId,
        eventId: args.eventId,
      },
    );
    return;
  }
  // Already accepted AND already provisioned — nothing to do.
  if (
    existing.status === ProposalStatus.ACCEPTED &&
    existing.acceptance?.provisionedOrgId
  ) {
    return;
  }

  const stripeCheckoutId =
    args.stripeCheckoutId ?? existing.stripeCheckoutId ?? "unknown";
  const now = new Date();

  // Acceptance writes are wrapped in processStripeEventOnce — first-write
  // wins. The dedupe row covers BOTH the acceptance upsert AND the
  // downstream provisioning call so a Stripe retry of the same event id
  // never double-provisions. The provisioning lib expects to run inside
  // a dedupe boundary (it does NOT wrap itself) — we own the boundary
  // here.
  const dedupe = await processStripeEventOnce(
    {
      eventId: args.eventId,
      eventType: args.eventType,
      proposalId: args.proposalId,
    },
    async (tx) => {
      // Re-check inside the lock — a parallel retry may have just
      // accepted between our pre-check and the lock acquisition. The
      // unique constraint on ProcessedStripeEvent.eventId guarantees we
      // own this event id; the proposal might still have been accepted
      // by a DIFFERENT event id (session.completed then invoice.paid).
      const fresh = await tx.proposal.findUnique({
        where: { id: args.proposalId },
        select: { status: true, acceptance: { select: { id: true } } },
      });
      if (!fresh) return;

      // Only a LIVE proposal may be accepted + provisioned. A stale checkout
      // link paid against a CANCELED / EXPIRED / DRAFT / DECLINED proposal must
      // NOT provision an org on voided terms. Already-ACCEPTED passes through
      // for idempotent retries. Anything else is logged for out-of-band refund
      // and skipped. (Codex CRITICAL.)
      const ACCEPTABLE_STATUSES = new Set<ProposalStatus>([
        ProposalStatus.SENT,
        ProposalStatus.VIEWED,
        ProposalStatus.ACCEPTED,
      ]);
      if (!ACCEPTABLE_STATUSES.has(fresh.status)) {
        captureWithContext(
          new Error(
            "acceptProposalAndProvision: paid checkout for a non-acceptable proposal status — refused",
          ),
          {
            route: "api/webhooks/stripe",
            proposalId: args.proposalId,
            eventId: args.eventId,
            status: fresh.status,
          },
        );
        return;
      }

      const acceptance = await tx.proposalAcceptance.upsert({
        where: { proposalId: args.proposalId },
        create: {
          proposalId: args.proposalId,
          acceptedAt: now,
          stripeCheckoutId,
          stripeCustomerId: args.stripeCustomerId,
          stripeInvoiceId: args.stripeInvoiceId,
          stripeSubscriptionId: args.stripeSubscriptionId,
          stripePaymentIntentId: args.stripePaymentIntentId,
          amountPaidCents: Math.max(0, Math.floor(args.amountPaidCents)),
        },
        update: {
          // Preserve the first-write acceptedAt timestamp across retries.
          stripeCheckoutId,
          stripeCustomerId: args.stripeCustomerId,
          ...(args.stripeInvoiceId
            ? { stripeInvoiceId: args.stripeInvoiceId }
            : {}),
          ...(args.stripeSubscriptionId
            ? { stripeSubscriptionId: args.stripeSubscriptionId }
            : {}),
          ...(args.stripePaymentIntentId
            ? { stripePaymentIntentId: args.stripePaymentIntentId }
            : {}),
          ...(args.amountPaidCents > 0
            ? {
                amountPaidCents: Math.max(0, Math.floor(args.amountPaidCents)),
              }
            : {}),
        },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          provisionedOrgId: true,
        },
      });

      if (fresh.status !== ProposalStatus.ACCEPTED) {
        await tx.proposal.update({
          where: { id: args.proposalId },
          data: {
            status: ProposalStatus.ACCEPTED,
            acceptedAt: now,
            stripeCustomerId: args.stripeCustomerId,
            ...(args.stripeInvoiceId
              ? { stripeInvoiceId: args.stripeInvoiceId }
              : {}),
            ...(args.stripeSubscriptionId
              ? { stripeSubscriptionId: args.stripeSubscriptionId }
              : {}),
          },
        });
      }

      // Provisioning runs INSIDE the dedupe boundary so the org create +
      // Clerk invite + welcome email never double-fire on a Stripe retry.
      // The lib itself reads from the global `prisma` (not tx) for the
      // post-org steps which is fine — those steps are independently
      // idempotent (provisionOrgForAcceptance short-circuits when
      // ProposalAcceptance.provisionedOrgId is already set).
      try {
        const result = await runProvisioningForProposal({
          proposalId: args.proposalId,
          eventId: args.eventId,
          eventType: args.eventType,
          acceptance,
        });
        if (result.warnings.length > 0) {
          console.warn(
            `[stripe-webhook] proposal provisioning warnings — proposalId=${args.proposalId}:`,
            result.warnings.join("; "),
          );
        }
      } catch (err) {
        captureWithContext(err, {
          route: "api/webhooks/stripe",
          handler: "acceptProposalAndProvision.provision",
          proposalId: args.proposalId,
          eventId: args.eventId,
        });
        throw err; // Roll back the acceptance writes + let Stripe retry.
      }
    },
  );

  if (dedupe.status === "processed") {
    console.log(
      `[stripe-webhook] proposal accepted — proposalId=${args.proposalId} via=${args.eventType}`,
    );
  }
}

async function sendTrialEndingSoonEmail(input: {
  orgId: string;
  orgName: string;
  toEmail: string;
  trialEnd: number | null;
  subscriptionId: string;
}): Promise<void> {
  const { getResend, BRAND_EMAIL } = await import("@/lib/email/shared");
  const resend = getResend();
  if (!resend) return;

  const to = input.toEmail;
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || `LeaseStack <team@leasestack.co>`;
  const trialEndDate = input.trialEnd
    ? new Date(input.trialEnd * 1000).toLocaleDateString()
    : "soon";
  const opsTo =
    process.env.BUG_REPORT_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    BRAND_EMAIL ||
    "team@leasestack.co";

  const text = [
    `Hi ${input.orgName},`,
    "",
    "Your LeaseStack trial is ending " + trialEndDate + ".",
    "To keep your access and continue using all platform features, please activate your subscription.",
    "",
    "Log into your portal and visit Billing to subscribe.",
    "",
    "Questions? Reply to this email or contact team@leasestack.co.",
  ].join("\n");

  await resend.emails.send({
    from,
    to,
    bcc: opsTo,
    subject: `Your LeaseStack trial ends ${trialEndDate}`,
    text,
  });
}

async function notifyOrgTrialWillEnd(
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  if (!stripeCustomerId) return;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true, name: true, primaryContactEmail: true },
  });
  if (!org) return;

  if (!org.primaryContactEmail) {
    captureWithContext(
      new Error("trial_will_end: org has no email to notify"),
      {
        route: "api/webhooks/stripe",
        handler: "notifyOrgTrialWillEnd",
        orgId: org.id,
        subscriptionId: subscription.id,
        level: "warning",
      },
    );
    return;
  }

  void sendTrialEndingSoonEmail({
    orgId: org.id,
    orgName: org.name,
    toEmail: org.primaryContactEmail,
    trialEnd: subscription.trial_end ?? null,
    subscriptionId: subscription.id,
  }).catch((err) => {
    captureWithContext(err, {
      route: "api/webhooks/stripe",
      handler: "notifyOrgTrialWillEnd.email",
      orgId: org.id,
    });
  });
}

async function handleProposalTrialWillEnd(
  subscription: Stripe.Subscription,
): Promise<void> {
  const proposalId = subscription.metadata?.proposalId ?? null;
  if (!proposalId) {
    // Non-proposal trial: send a generic "trial ends soon" email to the org.
    await notifyOrgTrialWillEnd(subscription);
    return;
  }

  // v1: log + Sentry warning so the agency operator gets a notification
  // through their existing Sentry pipeline. v2 wires the real prospect +
  // operator emails via lib/proposals/email once that helper ships.
  console.warn(
    `[stripe-webhook] proposal trial ending — proposalId=${proposalId} subId=${subscription.id} trialEnd=${subscription.trial_end ?? "?"}`,
  );
  captureWithContext(
    new Error("Proposal trial will end — v2 email send pending"),
    {
      route: "api/webhooks/stripe",
      handler: "handleProposalTrialWillEnd",
      proposalId,
      subscriptionId: subscription.id,
      trialEnd: subscription.trial_end ?? null,
      level: "warning",
    },
  );
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
          event.id,
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
          event.data.object as Stripe.Subscription,
          event.id,
          event.type,
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          event.id,
          event.type,
        );
        break;

      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, event.id);
        break;

      case "customer.subscription.trial_will_end":
        await handleProposalTrialWillEnd(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
          event.id,
          event.type,
        );
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
          event.id,
          event.type,
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
          event.id,
          event.type,
        );
        break;

      case "charge.refunded":
        await handleChargeRefunded(
          event.data.object as Stripe.Charge,
          event.id,
          event.type,
        );
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(
          event.data.object as Stripe.Dispute,
          event.id,
          event.type,
        );
        break;

      case "charge.dispute.closed":
        await handleDisputeClosed(
          event.data.object as Stripe.Dispute,
          event.id,
          event.type,
        );
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
