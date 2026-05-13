import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Calendar, ArrowRight } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { WEBSITE_BUILD_CAL_LINK } from "@/lib/billing/catalog";

// Post-Stripe-Checkout landing for paid website builds. We deliberately
// don't query session_id here — the webhook handles persistence. This
// page is purely confirmation + the next-step CTA (book the kickoff
// call). The Cal.com link is rendered straight from the catalog so we
// never drift.

export const metadata: Metadata = {
  title: `Website build payment received | ${BRAND_NAME}`,
  description:
    "Your website build is in our queue. Book your kickoff call to start the build.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function WebsiteBuildSuccessPage() {
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
          Your website build is in the queue.
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
          One last step. Book a 30-minute kickoff call so we can gather
          your brand assets, walk through your property details, and
          align on the design direction. We start building the moment
          the call wraps.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href={WEBSITE_BUILD_CAL_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#2563EB", color: "#ffffff" }}
          >
            <Calendar size={16} strokeWidth={2.5} aria-hidden="true" />
            Book kickoff call
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#1E2A3A",
              border: "1px solid #d6d3c8",
            }}
          >
            Go to portal
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
            <li>Book your kickoff call on the calendar above</li>
            <li>We send a short brand brief to fill out (5 minutes)</li>
            <li>Design starts within 48 hours of the call</li>
            <li>First review at the end of week one</li>
            <li>Site goes live on your domain</li>
          </ol>
          <p
            className="mt-3"
            style={{
              color: "#88867f",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
            }}
          >
            You can track build status from{" "}
            <Link
              href="/portal/billing"
              style={{
                color: "#2563EB",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              billing
            </Link>{" "}
            inside the portal.
          </p>
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
