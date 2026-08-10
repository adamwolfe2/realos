import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { getScope } from "@/lib/tenancy/scope";
import { getSiteUrl } from "@/lib/brand";
import { BASE_PLATFORM_KEY } from "@/lib/billing/feature-prices";
import { getFeatureStripePriceId } from "@/lib/billing/feature-stripe";
import { captureWithContext } from "@/lib/sentry";
import { getEffectiveFeatureCatalog } from "@/lib/billing/feature-prices";
import {
  billingCheckoutIdempotencyKey,
  canManageBilling,
  canonicalFeatureKeys,
  stripeTrialSchedule,
} from "@/lib/billing/checkout-policy";
import { isPlatformSubscriptionForOrg } from "@/lib/billing/stripe-state";

// ---------------------------------------------------------------------------
// POST /api/billing/checkout
//
// Creates the Stripe-hosted trial activation session. The request body is a
// UI hint only: property count, enabled features, trial end, customer, and
// tier are all resolved from the authenticated Organization on the server.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TODO(#26): Stripe-hosted invoice + receipt branding (logo, accent
// color, brand name, footer text) lives in the Stripe Dashboard, not
// here. Make sure the production account is set to:
//   - Brand color: #2563EB  (matches BRAND_COLOR / marketing site)
//   - Logo: /public/logos/leasestack-wordmark.png (uploaded to Stripe)
//   - Public business name: LeaseStack
//   - Support URL: https://www.leasestack.co
// We don't set these per-Checkout-session because Stripe only honors
// the account-level branding on subscription-mode invoices.

// Self-serve property cap. Anything above this routes to Enterprise
// sales contact. Matches SELF_SERVE_PROPERTY_CAP in lib/billing/catalog.ts.
const PROPERTY_CAP = 99;

const bodySchema = z.object({
  tierId: z.enum(["starter", "growth", "scale"]),
  cycle: z.literal("monthly").default("monthly"),
  propertyCount: z.number().int().min(1).max(PROPERTY_CAP).default(1),
  selectedModuleKeys: z.array(z.string().max(64)).max(20).optional(),
  source: z.literal("trial_activation"),
});

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe is not configured on this environment.",
      },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const scope = await getScope();

  // P1 (launch-critical-sweep): anonymous checkout is retired. Public pricing
  // routes prospects through sign-up → the no-card trial, so a Stripe
  // subscription can never be created before an Organization exists (which
  // orphaned the payment — charged customer, unlinked unpaid workspace). Reject
  // any scope-less request here.
  if (!scope) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please sign in to start or manage a subscription.",
        redirectTo: "/sign-up",
      },
      { status: 401 },
    );
  }

  if (!canManageBilling(scope)) {
    return NextResponse.json(
      { ok: false, error: "Only the workspace owner can manage billing." },
      { status: 403 },
    );
  }

  // Anonymous/public Checkout was retired. The only remaining caller is the
  // trial activation card, whose cart is rebuilt from server-owned org state
  // below. Rejecting generic requests prevents a hand-crafted body from
  // choosing a cheaper property count or module set.
  if (parsed.source !== "trial_activation") {
    return NextResponse.json(
      { ok: false, error: "Unsupported billing flow." },
      { status: 400 },
    );
  }

  // Resolve or create the Stripe Customer.
  let stripeCustomerId: string | null = null;
  const stripe = getStripeClient();
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      id: true,
      name: true,
      primaryContactEmail: true,
      stripeCustomerId: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      chosenTier: true,
      subscriptionTier: true,
      moduleChatbot: true,
      modulePixel: true,
      moduleSEO: true,
      moduleReputation: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      modulePopups: true,
      moduleCreativeStudio: true,
      moduleEmail: true,
      moduleOutboundEmail: true,
      moduleReferrals: true,
      moduleInsights: true,
      moduleMarketIntelligence: true,
      moduleAttribution: true,
    },
  });
  if (!org) {
    return NextResponse.json(
      { ok: false, error: "Organization not found for the current scope." },
      { status: 404 },
    );
  }
  if (org.subscriptionStatus !== "TRIALING") {
    return NextResponse.json(
      {
        ok: false,
        error: "This workspace does not have a trial awaiting activation.",
      },
      { status: 409 },
    );
  }

  const propertyCount = Math.max(
    1,
    await prisma.property.count({
      where: {
        orgId: org.id,
        lifecycle: { in: ["IMPORTED", "ACTIVE"] },
      },
    }),
  );
  if (propertyCount > PROPERTY_CAP) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Portfolios with more than 99 properties require an Enterprise billing setup.",
      },
      { status: 409 },
    );
  }
  let activeFeatures;
  try {
    ({ features: activeFeatures } = await getEffectiveFeatureCatalog({
      strict: true,
    }));
  } catch (error) {
    captureWithContext(error, {
      route: "api/billing/checkout/catalog",
      orgId: org.id,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Billing prices are temporarily unavailable. Please try again.",
      },
      { status: 503 },
    );
  }
  const selectedModuleKeys = canonicalFeatureKeys(
    activeFeatures.filter(
      (feature) => (org as Record<string, unknown>)[feature.key] === true,
    ).map((feature) => feature.key),
  );
  const orgTier = org.chosenTier ?? org.subscriptionTier;
  const tierId =
    orgTier === "STARTER"
      ? "starter"
      : orgTier === "GROWTH"
        ? "growth"
        : orgTier === "SCALE"
          ? "scale"
          : null;
  if (!tierId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Choose a supported subscription tier before activating.",
      },
      { status: 409 },
    );
  }

  if (org.stripeCustomerId) {
    stripeCustomerId = org.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create(
      {
        email: org.primaryContactEmail ?? scope.email,
        name: org.name,
        metadata: { org_id: org.id },
      },
      { idempotencyKey: `cust_${org.id}` },
    );
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id },
    });
    stripeCustomerId = customer.id;
  }

  const existingSubs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100,
  });
  const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired"]);
  const hasLiveSub = existingSubs.data.some(
    (subscription) =>
      !TERMINAL_STATUSES.has(subscription.status) &&
      isPlatformSubscriptionForOrg(subscription.metadata, org.id),
  );
  if (hasLiveSub) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "You already have a subscription in Stripe. Manage payment methods and invoices from the billing page.",
        redirectTo: "/portal/billing",
      },
      { status: 409 },
    );
  }

  // Bill the base platform plus every enabled catalog feature. The browser's
  // posted module list is deliberately ignored; only Organization flags can
  // create line items.
  const checkoutLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const basePriceId = await getFeatureStripePriceId(BASE_PLATFORM_KEY);
  if (!basePriceId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Feature prices aren't synced to Stripe yet. An admin must click \"Sync to Stripe\" on /admin/pricing first.",
      },
      { status: 503 },
    );
  }
  checkoutLineItems.push({ price: basePriceId, quantity: propertyCount });
  for (const key of selectedModuleKeys) {
    const priceId = await getFeatureStripePriceId(key);
    if (!priceId) {
      return NextResponse.json(
        {
          ok: false,
          error: `Feature "${key}" isn't priced in Stripe yet. Sync prices on /admin/pricing.`,
        },
        { status: 503 },
      );
    }
    checkoutLineItems.push({ price: priceId, quantity: propertyCount });
  }

  const siteUrl = getSiteUrl();
  const successUrl = `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = scope
    ? `${siteUrl}/portal/billing?canceled=1`
    : `${siteUrl}/pricing?canceled=1`;

  // Stash everything the webhook needs to provision the right
  // entitlements and attribute the conversion.
  const metadata: Stripe.MetadataParam = {
    tier: tierId.toUpperCase(),
    tier_id: tierId,
    cycle: parsed.cycle,
    property_count: String(propertyCount),
    intent: "trial_activation",
    org_id: org.id,
    feature_keys: selectedModuleKeys.join(","),
    ...(parsed.source ? { source: parsed.source } : {}),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: checkoutLineItems,
      customer: stripeCustomerId,
      // Save Checkout's billing identity back to the customer so Stripe Tax
      // and future invoices use the confirmed address and name.
      customer_update: {
        address: "auto",
        name: "auto",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      // Tax handling — turned on if you've configured Stripe Tax in
      // the dashboard; harmless otherwise. Combined with the
      // customer_update[address]=auto above so brand-new customers
      // capture an address at first Checkout.
      automatic_tax: { enabled: true },
      subscription_data: {
        metadata,
        ...stripeTrialSchedule(org.trialEndsAt),
      },
      metadata,
    },
    {
      // Dedupe a rapid double-submit of the exact same server-owned cart.
      // Price IDs are part of the fingerprint, so an admin price sync can
      // never reuse a Checkout Session created with an older amount.
      idempotencyKey: billingCheckoutIdempotencyKey({
        orgId: org.id,
        tierId,
        cycle: parsed.cycle,
        propertyCount,
        featureKeys: selectedModuleKeys,
        priceIds: checkoutLineItems.map((item) => String(item.price)),
        trialEndsAt: org.trialEndsAt,
      }),
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    captureWithContext(err, {
      route: "api/billing/checkout",
      tierId: parsed.tierId,
      cycle: parsed.cycle,
      orgId: org.id,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe Checkout is temporarily unavailable. Please try again.",
      },
      { status: 502 },
    );
  }
}

// Tiny GET helper so the route is discoverable in the browser during dev.
export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "POST the signed-in trial activation payload. Billing details are resolved from the workspace on the server.",
  });
}
