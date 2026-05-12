import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// /billing/success — the Stripe Checkout success_url destination.
//
// Stripe redirects here with ?session_id=cs_test_... after a successful
// checkout. We deliberately DO NOT verify the session on this page or
// provision anything — the webhook does that. This page exists purely
// to confirm to the prospect that the charge went through and tell them
// what happens next.
//
// Two scenarios:
//   1. Signed-up via /pricing (anonymous): we point them at /sign-up
//      so they can claim the account associated with their Stripe
//      customer email.
//   2. Signed-up via /onboarding (authed): we send them to /portal.
//
// We don't have a server scope here (the page is statically rendered),
// so we can't tell which one they are — we just show both paths.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Welcome to ${BRAND_NAME}`,
  description: "Your subscription is active.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function CheckoutSuccessPage() {
  return (
    <section
      style={{ backgroundColor: "#f5f4ed", minHeight: "calc(100vh - 80px)" }}
    >
      <div className="max-w-[720px] mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
        <div className="inline-flex items-center justify-center mb-6">
          <div
            className="rounded-full inline-flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              backgroundColor: "rgba(37,99,235,0.08)",
              color: "#2563EB",
            }}
          >
            <CheckCircle2 size={36} strokeWidth={2} aria-hidden="true" />
          </div>
        </div>

        <p className="eyebrow mb-3" style={{ color: "#2563EB" }}>
          Payment received
        </p>
        <h1
          className="heading-section"
          style={{ color: "#141413", maxWidth: 580, margin: "0 auto" }}
        >
          You&apos;re in. We&apos;re on it.
        </h1>
        <p
          className="mt-4 mx-auto"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          Your subscription is active. We&apos;ll kick off your build right now
          — most properties go live in under 14 days. You&apos;ll get an email
          within the next hour from your account manager with next steps and a
          link to upload your brand assets.
        </p>

        {/* Next-step rail. We don't know if they came in via /pricing
            (anonymous) or /onboarding (authed), so we show both. */}
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#2563EB", color: "#ffffff" }}
          >
            Create your account
          </Link>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#141413",
              border: "1px solid #141413",
            }}
          >
            I already have an account
          </Link>
        </div>

        <p
          className="mt-8"
          style={{
            color: "#88867f",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Questions? hello@leasestack.co
        </p>
      </div>
    </section>
  );
}
