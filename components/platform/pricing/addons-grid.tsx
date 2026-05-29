import { SectionEyebrow } from "@/components/platform/section-eyebrow";

// Add-ons grid. Self-serve add-ons only. Two flavors:
//
//   * Capability add-ons (recurring) flip a platform feature on. They
//     activate automatically the moment the subscription syncs from
//     Stripe.
//
//   * Capacity add-ons (metered) bill in arrears against actual usage
//     above the tier cap, using Stripe Billing Meters.
//
// Nothing in here requires our team's labor. Everything is bookable
// from the in-product billing portal once you're signed up.

type AddOn = {
  name: string;
  description: string;
  price: string;
  priceUnit: string;
  tag: string;
};

// Ordered by operator-priority per Norman's brief — capability first
// (most-asked-for modules), then capacity (usage overages).
const ADDONS: AddOn[] = [
  // ─── Capability add-ons (recurring) ───
  {
    name: "Reputation Pro",
    tag: "Capability",
    description:
      "Deeper ApartmentRatings crawl + Google Business reply automation + sentiment trending across every source. Flags negative mentions in under 6 hours.",
    price: "$99",
    priceUnit: "per month",
  },
  {
    name: "Keyword Trends",
    tag: "Capability",
    description:
      "Weekly competitor rank tracking across your top 200 keywords. What people are searching for, who's winning, where you're closest to top-3.",
    price: "$149",
    priceUnit: "per month",
  },
  {
    name: "AEO Boost",
    tag: "Capability",
    description:
      "Daily AI-search scans across Claude, ChatGPT, Gemini, and Perplexity. Per-prompt citation history + Content Drafter for the gaps. Standard runs weekly.",
    price: "$199",
    priceUnit: "per month",
  },
  {
    name: "Audience Sync",
    tag: "Capability",
    description:
      "Push your identified visitors to Meta, Google, and TikTok ad audiences as a custom audience or lookalike seed. Refreshes nightly.",
    price: "$129",
    priceUnit: "per month",
  },
  {
    name: "Outbound Email Engine",
    tag: "Capability",
    description:
      "Trigger drip sequences off identified visitors and chatbot drop-offs. Templates, deliverability monitoring, and a 3,000-send cap included.",
    price: "$179",
    priceUnit: "per month",
  },
  {
    name: "Integrations Pro",
    tag: "Capability",
    description:
      "AppFolio, RealPage, Yardi, HubSpot, and Salesforce two-way sync. Lead push + lease pull + audit log. Slack and Teams notifications included.",
    price: "$199",
    priceUnit: "per month",
  },
  {
    name: "Website Build",
    tag: "One-time",
    description:
      "Site Engine designs, builds, and ships your property marketing site in 14 days. Pre-installed pixel, chatbot, and lead capture. One-time delivery, then optional maintenance.",
    price: "$2,500",
    priceUnit: "one-time",
  },
  {
    name: "Custom domain",
    tag: "Capability",
    description:
      "Bring your own domain for the operator dashboard and outbound emails (e.g. portal.yourbrand.com). Includes SSL + SPF/DKIM setup.",
    price: "$49",
    priceUnit: "per month",
  },
  {
    name: "White-label workspace",
    tag: "Capability",
    description:
      "Removes LeaseStack branding from the operator dashboard, tenant portal, and outbound emails. For owners running multiple brands under one entity.",
    price: "$499",
    priceUnit: "per month",
  },

  // ─── Capacity add-ons (metered) ───
  {
    name: "Additional property",
    tag: "Capacity",
    description:
      "Add a property to your existing plan. Each property gets its own dashboard, chatbot, and lead pool, with one portfolio-level rollup.",
    price: "20% off",
    priceUnit: "the base tier",
  },
  {
    name: "Pixel visitor overage",
    tag: "Capacity",
    description:
      "Identify visitors beyond your plan cap. Billed monthly against actual identified visitors. Hard-capped at 100x your plan cap as a safety stop.",
    price: "$0.05",
    priceUnit: "per visitor",
  },
  {
    name: "Chatbot conversation overage",
    tag: "Capacity",
    description:
      "Conversations beyond your plan cap. Same model quality, same lead-capture rules, same hot-lead routing — just more of them.",
    price: "$0.08",
    priceUnit: "per conversation",
  },
  {
    name: "Outbound email overage",
    tag: "Capacity",
    description:
      "Sends beyond the 3,000-per-month cap. Includes the same deliverability monitoring, unsubscribe handling, and bounce processing as base sends.",
    price: "$0.01",
    priceUnit: "per send",
  },
];

export function AddonsGrid() {
  return (
    <section
      style={{
        backgroundColor: "#F1F5F9",
        borderTop: "1px solid #E2E8F0",
        borderBottom: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24">
        <div className="max-w-2xl mb-10">
          <SectionEyebrow>Add-ons</SectionEyebrow>
          <h2
            className="heading-section mt-3"
            style={{ color: "#1E2A3A", fontSize: "clamp(24px, 3vw, 32px)" }}
          >
            Tune the plan without changing tiers.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.55,
            }}
          >
            Every add-on works on any plan. Toggle them on inside the billing
            portal after signup. Capacity add-ons only charge for usage above
            your plan cap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ADDONS.map((item) => (
            <div
              key={item.name}
              className="rounded-xl p-5"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #E2E8F0",
              }}
            >
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#2563EB",
                      fontWeight: 600,
                      marginBottom: "4px",
                    }}
                  >
                    {item.tag}
                  </div>
                  <h3
                    style={{
                      color: "#1E2A3A",
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      fontWeight: 600,
                      letterSpacing: "-0.008em",
                    }}
                  >
                    {item.name}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div
                    style={{
                      color: "#1E2A3A",
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      fontWeight: 700,
                    }}
                  >
                    {item.price}
                  </div>
                  <div
                    style={{
                      color: "#88867f",
                      fontFamily: "var(--font-sans)",
                      fontSize: "11px",
                    }}
                  >
                    {item.priceUnit}
                  </div>
                </div>
              </div>
              <p
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.55,
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
