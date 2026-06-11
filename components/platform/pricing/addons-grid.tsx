import { SectionEyebrow } from "@/components/platform/section-eyebrow";

// À-la-carte pricing grid. The per-feature prices are driven from the LIVE
// admin catalog (getEffectiveFeatureCatalog → FeaturePrice), so the marketing
// site always matches what a prospect sees in the onboarding cart and what an
// admin sets under /admin/pricing. The capacity/one-time extras below the
// catalog (overages, website build, custom domain, white-label) are not part of
// the per-property feature catalog and stay defined here.

type CatalogFeature = {
  name: string;
  copy: string;
  monthlyCents: number;
  recommended?: boolean;
};

type Extra = {
  name: string;
  description: string;
  price: string;
  priceUnit: string;
  tag: string;
};

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// Non-catalog extras: usage capacity (metered) + one-time + workspace add-ons.
const EXTRAS: Extra[] = [
  {
    name: "Website Build",
    tag: "One-time",
    description:
      "Site Engine designs, builds, and ships your property marketing site in 14 days — pixel, chatbot, and lead capture pre-installed.",
    price: "$2,500",
    priceUnit: "one-time",
  },
  {
    name: "Custom domain",
    tag: "Workspace",
    description:
      "Bring your own domain for the dashboard and outbound emails (e.g. portal.yourbrand.com). Includes SSL + SPF/DKIM.",
    price: "$49",
    priceUnit: "per month",
  },
  {
    name: "White-label workspace",
    tag: "Workspace",
    description:
      "Removes LeaseStack branding from the dashboard, tenant portal, and outbound emails. For owners running multiple brands.",
    price: "$499",
    priceUnit: "per month",
  },
  {
    name: "Pixel visitor overage",
    tag: "Capacity",
    description:
      "Identify visitors beyond your plan cap. Billed monthly against actual identified visitors, hard-capped for safety.",
    price: "$0.05",
    priceUnit: "per visitor",
  },
  {
    name: "Chatbot conversation overage",
    tag: "Capacity",
    description:
      "Conversations beyond your plan cap — same model quality, same lead-capture rules, same hot-lead routing.",
    price: "$0.08",
    priceUnit: "per conversation",
  },
  {
    name: "Outbound email overage",
    tag: "Capacity",
    description:
      "Sends beyond the monthly cap, with the same deliverability monitoring, unsubscribe handling, and bounce processing.",
    price: "$0.01",
    priceUnit: "per send",
  },
];

export function AddonsGrid({
  features,
  basePlatformCents,
}: {
  features: CatalogFeature[];
  basePlatformCents: number;
}) {
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
          <SectionEyebrow>À la carte</SectionEyebrow>
          <h2
            className="heading-section mt-3"
            style={{ color: "#1E2A3A", fontSize: "clamp(24px, 3vw, 32px)" }}
          >
            One base, then add what each property needs.
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
            Start with the {dollars(basePlatformCents)}/property platform, then
            turn on only the features you want. Every price is per property, per
            month, billed on a 14-day free trial — no card to start.
          </p>
        </div>

        {/* Base platform — always included. */}
        <div
          className="rounded-xl p-5 mb-3 flex items-baseline justify-between gap-3"
          style={{ backgroundColor: "#ffffff", border: "1px solid #2563EB" }}
        >
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
              Always included
            </div>
            <h3
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              LeaseStack platform
            </h3>
            <p
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                lineHeight: 1.55,
                marginTop: "4px",
              }}
            >
              Property dashboard, lead inbox, website, and team — the foundation
              every feature plugs into.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                fontWeight: 700,
              }}
            >
              {dollars(basePlatformCents)}
            </div>
            <div
              style={{
                color: "#88867f",
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
              }}
            >
              per property / mo
            </div>
          </div>
        </div>

        {/* Catalog features — live prices. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((item) => (
            <div
              key={item.name}
              className="rounded-xl p-5"
              style={{ backgroundColor: "#ffffff", border: "1px solid #E2E8F0" }}
            >
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: item.recommended ? "#2563EB" : "#94A3B8",
                      fontWeight: 600,
                      marginBottom: "4px",
                    }}
                  >
                    {item.recommended ? "Popular" : "Feature"}
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
                    {dollars(item.monthlyCents)}
                  </div>
                  <div
                    style={{
                      color: "#88867f",
                      fontFamily: "var(--font-sans)",
                      fontSize: "11px",
                    }}
                  >
                    per property / mo
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
                {item.copy}
              </p>
            </div>
          ))}
        </div>

        {/* Non-catalog extras: capacity overages + one-time + workspace. */}
        <h3
          className="mt-12 mb-4"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#64748B",
            fontWeight: 600,
          }}
        >
          Capacity &amp; extras
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {EXTRAS.map((item) => (
            <div
              key={item.name}
              className="rounded-xl p-5"
              style={{ backgroundColor: "#ffffff", border: "1px solid #E2E8F0" }}
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
