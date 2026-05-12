"use client";

import * as React from "react";
import { Plus, Minus } from "lucide-react";

// Pricing FAQ. Eight items max. Self-serve framing. Answers the
// deal-breaker objections only. Anything else is faster on a call.

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does signup work?",
    a: "Create your account at /sign-up with an email and password. Pick a plan on the /pricing page and pay through Stripe Checkout. Your workspace is provisioned the moment payment confirms. From inside the portal you connect AppFolio (optional), install the chatbot widget on your site, configure your brand, and add properties. No sales calls required and no one walks you through it; the setup is point and click.",
  },
  {
    q: "How does per-property pricing work?",
    a: "Each property under your workspace gets its own marketing site, listings sync, AI chatbot, and lead pool. The first property pays the base tier price. Each additional property on the same plan gets a 20 percent discount applied automatically through the subscription quantity. You bump the property count up or down from your billing settings.",
  },
  {
    q: "Is there a setup fee?",
    a: "No. The platform is self-serve. You sign up, pay the monthly subscription, connect your data, and start working. No one-time fees, no implementation charges, no required onboarding calls. Custom PMS integrations beyond AppFolio are handled separately through sales contact and quoted on a per-project basis.",
  },
  {
    q: "Are there any contracts?",
    a: "No. Every plan is month-to-month. You can cancel any time from the Stripe billing portal linked inside your account settings. Annual prepay is optional and saves you about 17 percent versus paying monthly, but you give up the month-to-month off-ramp until the year is over.",
  },
  {
    q: "What is the money-back guarantee?",
    a: "30 days. If the platform isn't working for you within the first month, email hello@leasestack.co and we'll refund the subscription fee in full, no questions asked. Your data stays accessible during the refund process and you can export your leads, visitors, and reports on the way out.",
  },
  {
    q: "Do you run ads for me?",
    a: "No, you run them yourself using our campaign builder. Growth and Scale tiers unlock the in-product Google and Meta ad campaign builder where you connect your own ad accounts and we provide the UI, attribution, and creative library. We do not manage ad spend or charge a markup on what you spend with Google or Meta.",
  },
  {
    q: "What PMS systems do you support?",
    a: "AppFolio is the only direct integration today. If you use Yardi, Buildium, Entrata, RealPage or another PMS, contact sales for a custom connector quote (typically 2 to 4 weeks of build time, priced per project). Manual property and listing entry works on any plan if you don't have a supported PMS or just want to get started without connecting one.",
  },
  {
    q: "Can I bring my own website?",
    a: "Yes. You can install the chatbot widget and Cursive visitor pixel on any existing site by pasting a script tag from your portal settings. Pricing stays the same. Lead capture, ad campaigns, reputation monitoring, and audiences all work the same way on top of your own site as they do on a site built inside our builder.",
  },
];

export function PricingFaq() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="mb-8 md:mb-10">
          <p className="eyebrow mb-3">Pricing FAQ</p>
          <h2
            className="heading-section"
            style={{ color: "#141413", fontSize: "clamp(24px, 3vw, 32px)" }}
          >
            The deal-breaker questions.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
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
                      backgroundColor: open ? "#2563EB" : "#f5f4ed",
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
