"use client";

import * as React from "react";
import { Plus, Minus } from "lucide-react";

// Pricing FAQ — answers the deal-breaker objections only. Eight items max;
// anything else belongs in the sales conversation. Accordion pattern so the
// page doesn't grow into a wall of text for the 80% of buyers who skim.

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is this software or a service?",
    a: "Both. You get the platform — site, dashboard, chatbot, pixel, integrations — and our team operates it. We launch the marketing site, run the ad accounts, request the creative, write the SEO content, and respond to negative reviews. You get a weekly summary and a dashboard to peek under the hood whenever.",
  },
  {
    q: "How does per-property pricing work?",
    a: "Each property gets its own site, listings sync, chatbot, and ad accounts. The first property pays the base tier price; each additional property on the same plan gets a 20% discount. You can mix tiers across properties — a flagship on Scale and a small property on Foundation is fine.",
  },
  {
    q: "What does the setup fee cover?",
    a: "The site build, brand setup, AppFolio connection (or manual listings if you're not on AppFolio), chatbot training on your property's FAQs, domain + SSL configuration, and the first ad account setup if you're on Growth or Scale. It's a one-time charge billed at signing.",
  },
  {
    q: "Are there any contracts?",
    a: "No. Every plan is month-to-month. You can pause your subscription (we hold your site live with a \"coming soon\" splash) or cancel at any time. Annual prepay is optional — it saves you ~17% but you lose the monthly off-ramp.",
  },
  {
    q: "What's the money-back guarantee?",
    a: "30 days. If you don't see real lead volume or attribution by day 30, we refund the subscription fee. The setup fee is non-refundable since the work is already done — but we'll hand you the assets we built so you can take them elsewhere.",
  },
  {
    q: "How does the ad spend markup work?",
    a: "When we run your Google or Meta ads, we charge a 15% management fee on top of the spend you pay the platforms. So $5,000/mo in ad spend = $750/mo to us. There's no markup if you run your own ads — you only pay for the management when we manage.",
  },
  {
    q: "Do you support PMS systems besides AppFolio?",
    a: "AppFolio is the only direct integration today. For Yardi, Buildium, Entrata, RealPage, and others, we offer a custom connector build (typically 2-4 weeks, $5K-$15K one-time + $200/mo per source). Manual listings work for any operator.",
  },
  {
    q: "Can I bring my own website instead?",
    a: "Yes — you'd lose the site-build portion of the setup fee but the chatbot, pixel, lead capture, ads, reputation, and audiences all work on top of any site. You'd install the pixel + chatbot widget on your existing pages. Pricing stays the same.",
  },
];

export function PricingFaq() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  return (
    <section style={{ backgroundColor: "#f5f4ed", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="mb-10 md:mb-12">
          <p className="eyebrow mb-4">Pricing FAQ</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            The deal-breaker questions.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            Eight things buyers consistently ask before signing. Everything else
            is faster on a call.
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
                  border: "1px solid #e8e6dc",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#faf9f5]"
                >
                  <span
                    style={{
                      color: "#141413",
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
                      backgroundColor: open ? "#141413" : "#f5f4ed",
                      color: open ? "#ffffff" : "#5e5d59",
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
                      color: "#4d4c48",
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
