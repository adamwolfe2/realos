"use client";

import * as React from "react";
import { Plus, Minus } from "lucide-react";

// Pricing FAQ. Eight items max. Self-serve framing. Answers the
// deal-breaker objections only. Anything else is faster on a call.

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does this compare to a CLX-style retainer?",
    a: "A typical residential leasing-marketing retainer runs $3,500 to $8,000 per property per month and gives you a deck of impressions, clicks, and reach. LeaseStack runs $899 per month on Standard for the same single property, and you get a full read on every channel your spend is touching plus a written recommendation on what to do about it. The math is straightforward: we replace your retainer and give you more data for less money.",
  },
  {
    q: "What is the free pilot, exactly?",
    a: "Zero dollars. We connect to your existing stack (PMS, Google Ads, Meta, GSC, GA4, your site) and show you what your data actually says. You get a weekly snapshot, the underlying numbers, and one operator-written recommendation on what to fix first. No card on file, no commitment, no calendar pressure. If you like what you see, you upgrade to Standard. If you do not, you close the tab.",
  },
  {
    q: "What happens if pacing does not move?",
    a: "You cancel. The Standard plan is month-to-month for exactly this reason. We are operator-built, which means we know that any tool that does not move a number is overhead. Inside 30 days you should see whether the recommendations land. If they do not, the billing portal cancels you in two clicks and your data exports cleanly.",
  },
  {
    q: "What is included in the monthly fee?",
    a: "On Standard: connections to your existing stack, identified-visitor pixel (5,000 per month), AI leasing chatbot (5,000 conversations per month), source-to-lease attribution across Google and Meta, reputation monitoring, and a weekly operator-written read on every channel. No ad spend markup. No setup fee. No required onboarding call. You bring your own ad accounts, your own site, your own PMS login.",
  },
  {
    q: "Do you replace my property manager or leasing staff?",
    a: "No. LeaseStack replaces the manual work, not the people. The platform tells your team exactly what the data says and what to do about it. Your leasing agents still tour, your property manager still runs the asset, your in-house marketer (if you have one) still owns the calendar. We just stop the meeting where nobody can answer how many leases the spend produced.",
  },
  {
    q: "What integrates with LeaseStack today?",
    a: "AppFolio is the direct PMS integration. Google Ads, Meta Ads, Google Search Console, GA4, Google Business Profile, Reddit, and the open web are all read live. If you run Yardi, Buildium, Entrata, or RealPage we have manual entry today and custom connectors quoted per project (typically 2 to 4 weeks). The pilot does not require a PMS connection at all; the marketing and pacing reads work without it.",
  },
  {
    q: "Are you a marketing agency?",
    a: "No. LeaseStack is a leasing intelligence platform. We do not buy ads on your behalf, we do not write your creative for you, and we do not charge a percent of spend. We tell your existing program (or your agency, if you keep one) what is working, what is not, and what to do next. The product is the data and the recommendation, not the labor.",
  },
  {
    q: "Are there any contracts?",
    a: "No long-term contracts. Every plan is month-to-month and cancellable in two clicks from the Stripe billing portal. Annual prepay is optional and saves you about 17 percent. Portfolio and Enterprise plans can opt into annual or multi-year terms if it helps the asset-side accounting, but it is never required.",
  },
];

export function PricingFaq() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="mb-8 md:mb-10">
          <p className="eyebrow mb-3">Pricing FAQ</p>
          <h2
            className="heading-section"
            style={{ color: "#1E2A3A", fontSize: "clamp(24px, 3vw, 32px)" }}
          >
            The questions operators ask before they sign.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            Cost versus retainer, what is included, cancellation, integrations,
            and what happens if pacing does not move. Everything else is faster
            on a call.
          </p>
        </div>

        <ul className="space-y-2">
          {FAQS.map((faq, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={idx}
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #E2E8F0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#F1F5F9]"
                >
                  <span
                    style={{
                      color: "#1E2A3A",
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      fontWeight: 600,
                      letterSpacing: "-0.008em",
                    }}
                  >
                    {faq.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 rounded-full"
                    style={{
                      width: "26px",
                      height: "26px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: open ? "#2563EB" : "#FFFFFF",
                      color: open ? "#ffffff" : "#64748B",
                      transition: "background-color 120ms ease",
                    }}
                  >
                    {open ? (
                      <Minus size={14} strokeWidth={2.5} />
                    ) : (
                      <Plus size={14} strokeWidth={2.5} />
                    )}
                  </span>
                </button>
                {open ? (
                  <div
                    className="px-5 pb-5"
                    style={{
                      color: "#1E2A3A",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14.5px",
                      lineHeight: 1.65,
                    }}
                  >
                    {faq.a}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
