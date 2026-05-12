"use client";

import * as React from "react";
import { Plus, Minus } from "lucide-react";

// Pricing FAQ. Eight items max. Self-serve framing. Answers the
// deal-breaker objections only. Anything else is faster on a call.

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does signup and onboarding work?",
    a: "Sign up at /sign-up with an email and password. The onboarding wizard walks you through naming your workspace, adding your first property, choosing a plan, paying through Stripe, and connecting AppFolio (or skipping that step for later). The whole flow takes about 10 minutes and the workspace is usable immediately after checkout. You set everything up yourself from inside the product. No sales calls required.",
  },
  {
    q: "How does per-property pricing work?",
    a: "Each property gets its own marketing site, listings sync, AI chatbot, and CRM. The first property pays the base tier price. Each additional property on the same plan gets a 20 percent discount. You can mix tiers across properties by running multiple workspaces, but most operators put their whole portfolio on one plan at the same tier for simplicity.",
  },
  {
    q: "Is there a setup fee?",
    a: "No. The platform is self-serve. You sign up, pay the monthly subscription, connect your data, and start working. No one-time fees, no implementation charges, no required onboarding calls. Custom PMS integrations beyond AppFolio are handled separately through sales contact and quoted on a per-project basis.",
  },
  {
    q: "Are there any contracts?",
    a: "No. Every plan is month-to-month. You can pause your subscription (your workspace stays read-only and your data is preserved) or cancel any time from the billing portal. Annual prepay is optional and saves you about 17 percent, but you give up the monthly off-ramp.",
  },
  {
    q: "What is the money-back guarantee?",
    a: "30 days. If the platform doesn't work for you for any reason, request a refund from inside the billing portal and we'll return the subscription fee no questions asked. Your data exports are available before, during, and after the refund window.",
  },
  {
    q: "Do you run ads for me?",
    a: "No, you run them yourself using our campaign builder. Growth and Scale tiers unlock the in-product Google and Meta ad campaign builder where you connect your own ad accounts and we provide the UI, attribution, and creative library. We do not manage ad spend or charge a markup on what you spend with Google or Meta.",
  },
  {
    q: "What PMS systems do you support?",
    a: "AppFolio is the only direct integration today. If you use Yardi, Buildium, Entrata, RealPage or another PMS, contact sales for a custom connector quote. Manual property and listing entry works on any plan if you don't have a supported PMS.",
  },
  {
    q: "Can I bring my own website?",
    a: "Yes. You can install the chatbot widget and Cursive pixel on any existing site and skip our site builder entirely. Pricing is unchanged. Lead capture, ad campaigns, reputation monitoring, and audiences all work the same way on top of your own site.",
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
