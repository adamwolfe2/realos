import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { getScope } from "@/lib/tenancy/scope";
import { getSiteUrl } from "@/lib/brand";
import {
  WEBSITE_BUILD_CAL_LINK,
  getWebsiteBuildById,
} from "@/lib/billing/catalog";
import { getPriceId } from "@/lib/billing/plans";
import { captureWithContext } from "@/lib/sentry";

// ---------------------------------------------------------------------------
// POST /api/billing/website-build
//
// Starts the paid custom-website-build flow. Two SKUs: standard
// ($2,500) and premium ($4,500). Both are one-time payments. After
// Stripe Checkout completes, the webhook (lib/webhooks/stripe) upserts
// a WebsiteBuildRequest row and the success page surfaces the Cal.com
// kickoff-call booking link.
//
// Auth: signed-in user with an Organization. Anonymous prospects can't
// buy a website build until they have a LeaseStack account — they have
// to sign up and finish the wizard first. We keep this rule firm so
// every WebsiteBuildRequest ties to a real workspace from day one.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  buildId: z.enum(["standard", "premium"]),
  propertyId: z.string().min(1).max(120).optional(),
  // Free-form intake captured at checkout time. Persisted on the
  // WebsiteBuildRequest row so fulfillment doesn't have to re-ask.
  intake: z
    .object({
      preferredStyle: z.string().max(2000).optional(),
      existingDomain: z.string().max(255).optional(),
      referenceUrls: z.array(z.string().max(2048)).max(10).optional(),
      notes: z.string().max(4000).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  const scope = await getScope();
  if (!scope) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sign in to LeaseStack before purchasing a website build. We tie every build to your workspace so fulfillment can start immediately.",
      },
      { status: 401 },
    );
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const build = getWebsiteBuildById(parsed.buildId);
  if (!build) {
    return NextResponse.json(
      { ok: false, error: `Unknown build "${parsed.buildId}"` },
      { status: 400 },
    );
  }

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
      { ok: false, error: "Organization not found" },
      { status: 404 },
    );
  }

  const stripe = getStripeClient();

  // Reuse or create the Stripe customer. We use the same customer
  // record across SaaS subscription + website build so the customer
  // sees a single billing history on their portal.
  let stripeCustomerId = org.stripeCustomerId;
  if (!stripeCustomerId) {
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

  const siteUrl = getSiteUrl();
  const successUrl = `${siteUrl}/billing/website-build/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}/portal/billing?canceled=website_build`;

  const metadata: Stripe.MetadataParam = {
    kind: "website_build",
    build_id: parsed.buildId,
    org_id: org.id,
    ...(parsed.propertyId ? { property_id: parsed.propertyId } : {}),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: getPriceId(build.priceLookupKey),
          quantity: 1,
        },
      ],
      customer: stripeCustomerId,
      customer_update: {
        address: "auto",
        name: "auto",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      automatic_tax: { enabled: true },
      metadata,
      payment_intent_data: {
        metadata,
        description: `${build.productName} for ${org.name}`,
      },
    });

    // Pre-create a `requested` row so fulfillment sees the build the
    // moment payment lands. We backfill the Stripe session id on the
    // webhook so any retries / status flips remain idempotent.
    // The intake JSON is stored now so the customer doesn't lose it
    // if the webhook is delayed.
    await prisma.websiteBuildRequest.create({
      data: {
        orgId: org.id,
        propertyId: parsed.propertyId ?? null,
        stripeCheckoutSessionId: session.id,
        amountPaidCents: 0, // populated by webhook on success
        status: "requested",
        calBookingUrl: WEBSITE_BUILD_CAL_LINK,
        intakeJson: parsed.intake ?? {},
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      calBookingUrl: WEBSITE_BUILD_CAL_LINK,
    });
  } catch (err) {
    captureWithContext(err, {
      route: "api/billing/website-build",
      buildId: parsed.buildId,
      orgId: org.id,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to create checkout session",
      },
      { status: 502 },
    );
  }
}
