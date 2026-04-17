import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";

// Returns the Stripe Customer Portal URL for the current tenant, or an
// explanatory 503 if Stripe isn't configured yet. Sprint 05 wires the
// portal link in the UI; Sprint 10 may extend with invoice history.
export async function POST() {
  try {
    const scope = await requireScope();
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured yet, contact your account manager." },
        { status: 503 }
      );
    }
    const org = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { id: true, stripeCustomerId: true },
    });
    if (!org?.stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe customer on file yet. Your account manager creates it with the first invoice.",
        },
        { status: 404 }
      );
    }

    const returnUrl =
      (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") +
      "/portal/billing";

    const session = await getStripeClient().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
