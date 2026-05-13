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

const ADDONS: AddOn[] = [
  {
    name: "Additional property",
    tag: "Capacity",
    description:
      "Add a property to your existing plan. Each property gets its own pacing read, chatbot, and lead pool, with one portfolio-level rollup across all of them.",
    price: "20% off",
    priceUnit: "the base tier",
  },
  {
    name: "Reputation Pro",
    tag: "Capability",
    description:
      "Adds commercial real estate and hospitality review sources (Tripadvisor, Niche, deeper ApartmentRatings crawl) on top of the standard reputation monitoring.",
    price: "$99",
    priceUnit: "per month",
  },
  {
    name: "White-label workspace",
    tag: "Capability",
    description:
      "Removes LeaseStack branding from the operator dashboard, the tenant portal, and outbound emails. For owners running multiple brands under one entity.",
    price: "$499",
    priceUnit: "per month",
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
    name: "Outbound email overage",
    tag: "Capacity",
    description:
      "Sends beyond the 3,000 per month cap on Portfolio. Includes the same deliverability monitoring, unsubscribe handling, and bounce processing as your base sends.",
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
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-2xl mb-10">
          <p className="eyebrow mb-3">Add-ons</p>
          <h2
            className="heading-section"
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
