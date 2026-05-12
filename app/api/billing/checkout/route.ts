import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { getScope } from "@/lib/tenancy/scope";
import { getSiteUrl } from "@/lib/brand";
import { ADDONS, getTierById, resolveLineItems } from "@/lib/billing/plans";
import { captureWithContext } from "@/lib/sentry";

// ---------------------------------------------------------------------------
// POST /api/billing/checkout
//
// Creates a Stripe Checkout Session for a new subscription or upgrade.
//
// Three callers in flight:
//
//   1. Public /pricing page (anonymous prospect):
//      No scope. We create a Stripe Customer with the email they enter
//      at Checkout, and the webhook (`customer.created` + `checkout.
//      session.completed`) provisions the Organization row on the way
//      back. `metadata.intent="signup"` flags this case for the
//      webhook handler.
//
//   2. Authed prospect coming through /onboarding:
//      Scope exists, Organization exists (created at signup), no
//      Stripe customer yet. We create the customer here, attach it to
//      the org, then start the Checkout session.
//
//   3. Existing customer upgrading or adding a property:
//      Scope + Organization + stripeCustomerId all present. Start a
//      Checkout session in `mode: "subscription"` with the new items.
//      For pure upgrades (no setup fee, just tier change) the operator
//      should use the Stripe Customer Portal — this endpoint is for
//      signups + add-on purchases.
//
// All scenarios share the same Checkout Session shape so the success
// page + webhook can normalize them.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-serve property cap. Anything above this routes to Enterprise
// sales contact. Matches SELF_SERVE_PROPERTY_CAP in lib/billing/catalog.ts.
const PROPERTY_CAP = 99;

const bodySchema = z.object({
  tierId: z.enum(["starter", "growth", "scale"]),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
  propertyCount: z.number().int().min(1).max(PROPERTY_CAP).default(1),
  addOnLookupKeys: z.array(z.string().max(80)).max(10).optional(),
  // Only used for anonymous (scope-less) signups so we can prefill the
  // Checkout email field and the customer email after creation.
  prospectEmail: z.string().email().max(254).optional(),
  // Optional UTM-style context — recorded on the session metadata so
  // we can attribute conversions back to landing pages.
  source: z.string().max(64).optional(),
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

  const tier = getTierById(parsed.tierId);
  if (!tier) {
    return NextResponse.json(
      { ok: false, error: `Unknown tier "${parsed.tierId}"` },
      { status: 400 },
    );
  }

  const scope = await getScope();

  // Resolve or create the Stripe Customer.
  let stripeCustomerId: string | null = null;
  let orgIdMetadata: string | null = null;
  const stripe = getStripeClient();

  if (scope) {
    const org = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        name: true,
        primaryContactEmail: true,
        stripeCustomerId: true,
      },
    });
    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Organization not found for the current scope." },
        { status: 404 },
      );
    }
    orgIdMetadata = org.id;
    if (org.stripeCustomerId) {
      stripeCustomerId = org.stripeCustomerId;
    } else {
      // Create the Stripe Customer and link it to the org now. The
      // webhook can't do this safely for the authed flow because the
      // session.completed event needs the customer attached at the
      // checkout time so we can scope add-on purchases later.
      const customer = await stripe.customers.create({
        email: org.primaryContactEmail ?? scope.email,
        name: org.name,
        metadata: { org_id: org.id },
      });
      await prisma.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customer.id },
      });
      stripeCustomerId = customer.id;
    }
  }

  // Build the Checkout line items.
  let lineItems;
  try {
    lineItems = resolveLineItems({
      tier,
      cycle: parsed.cycle,
      propertyCount: parsed.propertyCount,
      addOnLookupKeys: parsed.addOnLookupKeys,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not build line items for the selected plan.",
      },
      { status: 500 },
    );
  }

  // Stripe Checkout requires every line item in `mode: subscription` to
  // either be a recurring price OR included via the `subscription_data`
  // path. One-time fees (setup, add-ons) ride along on the same
  // subscription invoice using `invoice_creation` / `add_invoice_items`
  // — but in Checkout mode they go into `line_items` as one-time prices,
  // which Stripe will bill on the first invoice alongside the
  // subscription. We use that path here.
  const checkoutLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    [];
  for (const item of lineItems) {
    if (item.kind === "subscription_tiered") {
      // Graduated tiered subscription item — single line, quantity = N
      // properties. Stripe applies the per-bracket discount math.
      checkoutLineItems.push({
        price: item.priceId,
        quantity: item.quantity,
      });
    } else if (item.kind === "subscription_addon") {
      checkoutLineItems.push({
        price: item.priceId,
        quantity: 1,
      });
    } else if (item.kind === "subscription_metered_addon") {
      // Metered prices have no quantity at Checkout. They aggregate
      // usage events reported later via cron in arrears.
      checkoutLineItems.push({
        price: item.priceId,
      });
    }
  }

  const siteUrl = getSiteUrl();
  const successUrl = `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = scope
    ? `${siteUrl}/portal/billing?canceled=1`
    : `${siteUrl}/pricing?canceled=1`;

  // Stash everything the webhook needs to provision the right
  // entitlements and attribute the conversion.
  const metadata: Stripe.MetadataParam = {
    tier: tier.tier,
    tier_id: tier.id,
    cycle: parsed.cycle,
    property_count: String(parsed.propertyCount),
    intent: scope ? "upgrade_or_add" : "signup",
    ...(orgIdMetadata ? { org_id: orgIdMetadata } : {}),
    ...(parsed.source ? { source: parsed.source } : {}),
    ...(parsed.addOnLookupKeys && parsed.addOnLookupKeys.length > 0
      ? { addons: parsed.addOnLookupKeys.join(",") }
      : {}),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: checkoutLineItems,
      customer: stripeCustomerId ?? undefined,
      // For anonymous signups, prefill the email so the prospect doesn't
      // re-type it after picking the plan.
      ...(stripeCustomerId
        ? {}
        : parsed.prospectEmail
          ? { customer_email: parsed.prospectEmail }
          : {}),
      // When `customer` is provided AND automatic_tax is on, Stripe
      // needs to know how to source the address used for tax
      // calculation. Brand-new orgs have no address on the Customer
      // record yet, so we tell Stripe to save the billing address the
      // prospect enters at Checkout back to the Customer (auto). Same
      // for name. This also satisfies the "Automatic tax calculation
      // in Checkout requires a valid address on the Customer" guard.
      ...(stripeCustomerId
        ? {
            customer_update: {
              address: "auto",
              name: "auto",
            },
          }
        : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      // Tax handling — turned on if you've configured Stripe Tax in
      // the dashboard; harmless otherwise. Combined with the
      // customer_update[address]=auto above so brand-new customers
      // capture an address at first Checkout.
      automatic_tax: { enabled: true },
      // Self-serve model: no trial, no setup fee. The 30-day money-
      // back guarantee is handled out-of-band per the FAQ.
      subscription_data: {
        metadata,
      },
      metadata,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    captureWithContext(err, {
      route: "api/billing/checkout",
      tierId: parsed.tierId,
      cycle: parsed.cycle,
      orgId: orgIdMetadata ?? undefined,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to create Checkout session",
      },
      { status: 502 },
    );
  }
}

// Tiny GET helper so the route is discoverable in the browser during dev.
export async function GET() {
  const tiers = ["starter", "growth", "scale"];
  return NextResponse.json({
    ok: true,
    info: "POST a JSON body with { tierId, cycle, propertyCount, addOnLookupKeys?, prospectEmail? }",
    tiers,
    addons: ADDONS.map((a) => ({
      lookup_key: a.priceLookupKey,
      label: a.uiLabel,
      mode: a.billingMode,
    })),
  });
}
