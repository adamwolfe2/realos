import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BRAND_NAME } from "@/lib/brand";
import { CheckCircle2, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// /billing/success — Stripe Checkout success_url destination.
//
// Stripe redirects here with ?session_id=cs_test_... after a successful
// checkout. We deliberately DO NOT verify the session contents here — the
// webhook does that asynchronously. This page exists to confirm to the
// buyer that the charge went through and route them to the right next
// step based on whether they already have an account.
//
// Routing logic:
//   1. Signed in with a Clerk session → redirect to /portal. The webhook
//      will have already linked their Organization to the Stripe customer
//      and flipped the right module flags.
//   2. Anonymous (no session, the most common case for prospects landing
//      here from the public /pricing page) → show the "create account"
//      next-step rail. Their Stripe customer is already in our database;
//      signup will match by email and provision the workspace.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Welcome to ${BRAND_NAME}`,
  description: "Your subscription is active.",
  robots: { index: false, follow: false },
};

// Needs to read the Clerk session per request to know which CTA path
// to render, so we can't static-prerender this anymore.
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage() {
  const { userId } = await auth();

  // Already signed in → straight to the portal. We pass a query flag
  // so /portal can show a one-time welcome / activation banner if it
  // wants to.
  if (userId) {
    redirect("/portal?welcome=1");
  }

  return (
    <section
      style={{ backgroundColor: "#FFFFFF", minHeight: "calc(100vh - 80px)" }}
    >
      <div className="max-w-[720px] mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
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
          style={{
            color: "#1E2A3A",
            maxWidth: 580,
            margin: "0 auto",
            fontSize: "clamp(28px, 4vw, 40px)",
          }}
        >
          Your subscription is active.
        </h1>
        <p
          className="mt-4 mx-auto"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          One more step. Create your account with the same email you used at
          checkout. Your workspace will be ready the moment you sign in.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#2563EB", color: "#ffffff" }}
          >
            Create your account
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#1E2A3A",
              border: "1px solid #d6d3c8",
            }}
          >
            Sign in
          </Link>
        </div>

        <div
          className="mt-12 mx-auto rounded-xl p-5 text-left"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #E2E8F0",
            maxWidth: 480,
          }}
        >
          <p
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "6px",
            }}
          >
            What happens next
          </p>
          <ol
            className="space-y-1.5"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.55,
              paddingLeft: "1.1em",
              listStyle: "decimal",
            }}
          >
            <li>Sign up with the email you used at checkout</li>
            <li>Add your first property and pick your branding</li>
            <li>Connect AppFolio or skip it for later</li>
            <li>Install the chatbot widget and pixel on your site</li>
          </ol>
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
