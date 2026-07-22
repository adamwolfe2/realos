"use client";

import * as React from "react";
import { Plus, Minus } from "lucide-react";

// Pricing FAQ. Self-serve, à-la-carte framing (2026-07-21 pricing rebuild):
//   - Pruned from 7 items to the 6 that matter most for the builder model.
//   - Dropped references to named tiers (Standard, Portfolio) since the
//     page no longer sells tiers; the base platform fee is $99/property.
//   - Renamed "free pilot" to "free trial" to match the builder's CTA and
//     hero copy.
//   - Added "Do I have to buy every feature?" to answer the a-la-carte
//     question directly instead of leaving it implicit.
//   - Kept the ad-management/agency question out; it described a service
//     outside the feature catalog this page now sells.

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does this compare to a marketing-agency retainer?",
    a: "A typical residential leasing-marketing retainer runs $3,500 to $8,000 per property per month and gives you a deck of impressions, clicks, and reach. LeaseStack starts at $99 per property per month for the base platform, plus only the features you turn on, and you get a full read on every channel your spend is touching plus a written recommendation on what to do about it. The math is straightforward: we replace your retainer and give you more insights for a more economical monthly fee.",
  },
  {
    q: "What is the free trial, exactly?",
    a: "Zero dollars for 14 days. We connect to your existing stack (PMS, Google Ads, Meta, GSC, GA4, your site) and show you what your dashboard actually says. You get a weekly snapshot, the underlying insights, and one operator-written recommendation on what to fix first. No card on file, no commitment. If you like what you see, your selection carries over. If you do not, you close the tab.",
  },
  {
    q: "Do I have to buy every feature?",
    a: "No. The base platform is the only required fee. Every feature on the builder above is optional, priced per property per month, and can be turned on or off any time from the billing portal. Pick the features each property actually needs instead of paying for a bundle built for someone else's portfolio.",
  },
  {
    q: "Does LeaseStack replace my leasing staff?",
    a: "No. LeaseStack saves your team manual work for tasks that would otherwise fall off the table. The platform tells your team exactly what the dashboard says and what to do about it. Your leasing agents still tour, your property manager still runs the asset, your in-house marketer (if you have one) still owns the calendar.",
  },
  {
    q: "What integrates with LeaseStack today?",
    a: "AppFolio is the direct PMS integration. Google Ads, Meta Ads, Google Search Console, GA4, Google Business Profile, Reddit, and the open web are all read live. If you run Yardi, Buildium, Entrata, or RealPage we have manual entry today and custom connectors quoted per project (typically 2 to 4 weeks). The free trial does not require a PMS connection at all; the marketing reads work without it.",
  },
  {
    q: "Are there any contracts?",
    a: "No long-term contracts. Every plan is month-to-month and flexible, managed from the Stripe billing portal in two clicks. Annual prepay is optional and saves you about 17 percent. Enterprise can opt into annual or multi-year terms if it helps the asset-side accounting, but it is never required.",
  },
  {
    q: "What happens if I leave?",
    a: "You keep everything. Cancel from the billing portal and we hand you a static export of your site plus your full lead history, no transition fee, no negotiation. The domain was never ours to hold hostage; it stayed in your name the whole time. You walk away owning more than you started with.",
  },
];

export function PricingFaq() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid var(--hair)",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24">
        <div className="mb-8 md:mb-10 max-w-2xl">
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
            Cost versus a traditional marketing-agency retainer, what is
            included, integrations, and the rest. Everything else is faster on
            a call.
          </p>
        </div>

        <ul className="space-y-2">
          {FAQS.map((faq, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={idx}
                className="rounded-[2px] overflow-hidden"
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--hair)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f4f4f4] active:scale-[0.98]"
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
                      backgroundColor: open ? "var(--color-primary)" : "#FFFFFF",
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
