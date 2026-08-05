import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { prisma } from "@/lib/db";
import { getScope } from "@/lib/tenancy/scope";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import {
  resolveCheckoutReturn,
  resolveScheduledTrialEnd,
  type CheckoutReturnState,
} from "@/lib/billing/checkout-return";
import { captureWithContext } from "@/lib/sentry";

export const metadata: Metadata = {
  title: `Checkout status | ${BRAND_NAME}`,
  description: "Verify your LeaseStack subscription Checkout status.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ session_id?: string }>;

const CONTENT: Record<
  CheckoutReturnState,
  { eyebrow: string; title: string; copy: string }
> = {
  active: {
    eyebrow: "Payment confirmed",
    title: "Your subscription is active.",
    copy: "Stripe confirmed the payment and LeaseStack has activated your workspace.",
  },
  scheduled: {
    eyebrow: "Payment method saved",
    title: "Your subscription is scheduled.",
    copy: "You were not charged today. Your workspace will remain unlocked and billing will begin when the current trial ends.",
  },
  processing: {
    eyebrow: "Payment confirmed",
    title: "Activation is processing.",
    copy: "Stripe confirmed the payment. LeaseStack is finishing the secure activation; refresh Billing in a moment.",
  },
  invalid: {
    eyebrow: "Verification needed",
    title: "We could not verify this Checkout session.",
    copy: "No payment or activation is being claimed on this page. Sign in and open Billing to review the current status safely.",
  },
};

function StatusIcon({ state }: { state: CheckoutReturnState }) {
  const props = { size: 36, strokeWidth: 2, "aria-hidden": true } as const;
  if (state === "active") return <CheckCircle2 {...props} />;
  if (state === "scheduled") return <CalendarCheck2 {...props} />;
  if (state === "processing") return <Clock3 {...props} />;
  return <CircleAlert {...props} />;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session_id: sessionId } = await searchParams;
  const scope = await getScope();
  let state: CheckoutReturnState = "invalid";
  let trialEndsAt: Date | null = null;

  if (scope && sessionId && isStripeConfigured()) {
    try {
      const [session, org] = await Promise.all([
        getStripeClient().checkout.sessions.retrieve(sessionId, {
          expand: ["subscription"],
        }),
        prisma.organization.findUnique({
          where: { id: scope.orgId },
          select: {
            stripeCustomerId: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        }),
      ]);
      if (org) {
        const sessionCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        const stripeSubscriptionStatus =
          typeof session.subscription === "object" && session.subscription
            ? session.subscription.status
            : null;
        const stripeTrialEnd =
          typeof session.subscription === "object" && session.subscription
            ? session.subscription.trial_end
            : null;
        state = resolveCheckoutReturn({
          expectedOrgId: scope.orgId,
          expectedCustomerId: org.stripeCustomerId,
          sessionOrgId: session.metadata?.org_id ?? null,
          sessionCustomerId,
          sessionMode: session.mode,
          sessionStatus: session.status,
          paymentStatus: session.payment_status,
          stripeSubscriptionStatus,
          subscriptionStatus: org.subscriptionStatus,
        });
        trialEndsAt =
          state === "scheduled"
            ? resolveScheduledTrialEnd(stripeTrialEnd, org.trialEndsAt)
            : org.trialEndsAt;
      }
    } catch (error) {
      captureWithContext(error, {
        route: "billing/success",
        orgId: scope.orgId,
      });
    }
  }

  const content = CONTENT[state];
  const isVerified = state !== "invalid";
  const href = scope ? "/portal/billing" : "/sign-in";

  return (
    <section className="min-h-[calc(100vh-80px)] bg-white">
      <div className="mx-auto max-w-[720px] px-4 py-20 text-center md:px-8 md:py-28">
        <div
          className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            backgroundColor: isVerified
              ? "rgba(37,99,235,0.08)"
              : "rgba(138,109,0,0.10)",
            color: isVerified ? "#2563EB" : "#8a6d00",
          }}
        >
          <StatusIcon state={state} />
        </div>
        <p className="eyebrow mb-3" style={{ color: isVerified ? "#2563EB" : "#8a6d00" }}>
          {content.eyebrow}
        </p>
        <h1 className="heading-section mx-auto max-w-[580px] text-[#1E2A3A]">
          {content.title}
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-[#64748B]">
          {content.copy}
        </p>
        {state === "scheduled" && trialEndsAt ? (
          <p className="mt-3 text-sm font-semibold text-[#1E2A3A]">
            Current trial ends {trialEndsAt.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : null}
        <div className="mt-10">
          <Link
            href={href}
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: "#2563EB" }}
          >
            {scope ? "Review billing" : "Sign in to verify"}
          </Link>
        </div>
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-[#88867f]">
          Questions? team@leasestack.co
        </p>
      </div>
    </section>
  );
}
