// Add-ons grid — surfaces the metered + flat upsells beneath the main
// tier cards. Two design rules:
//   1. Group add-ons by buying motion (capacity overage vs. capability
//      add vs. service add) so the operator can scan the right column.
//   2. Use a tabular feel (price column always right-aligned) so the
//      add-ons read as a menu, not a marketing wall.

type AddOn = {
  name: string;
  description: string;
  price: string;
  priceUnit?: string;
};

const CAPACITY: AddOn[] = [
  {
    name: "Additional property",
    description:
      "Add a property to your existing plan. Counts against the same Cursive Pixel + chatbot pools at lower marginal cost.",
    price: "20% off",
    priceUnit: "the base tier",
  },
  {
    name: "Pixel visitor overage",
    description:
      "Identify more website visitors beyond your plan's monthly cap. Billed monthly against actual identified visitors.",
    price: "$0.05",
    priceUnit: "per visitor",
  },
  {
    name: "Outbound email overage",
    description:
      "Above Scale's 3,000 sends/mo. Includes deliverability monitoring + unsubscribe handling.",
    price: "$0.01",
    priceUnit: "per send",
  },
  {
    name: "Extra ad creative requests",
    description:
      "On top of Growth's 2/mo cap. Each request = one new ad concept with 3 variants for A/B testing.",
    price: "$150",
    priceUnit: "per request",
  },
];

const CAPABILITY: AddOn[] = [
  {
    name: "Reputation Pro",
    description:
      "Adds commercial-RE and hospitality review sources (Tripadvisor, Niche, ApartmentRatings deep crawl) to the standard reputation monitoring.",
    price: "$99",
    priceUnit: "/mo",
  },
  {
    name: "White-label tenant portal",
    description:
      "Hides every \"Powered by LeaseStack\" reference across the tenant portal. Useful for agencies and operators reselling internally.",
    price: "$499",
    priceUnit: "/mo per portfolio",
  },
  {
    name: "Custom PMS integration",
    description:
      "We build a sync connector for your PMS if it isn't AppFolio. Yardi, Buildium, Entrata, RealPage, and others — usually 2–4 week buildout.",
    price: "$5K–$15K",
    priceUnit: "+ $200/mo per source",
  },
];

const SERVICE: AddOn[] = [
  {
    name: "Premium SLA",
    description:
      "1-hour response time during business hours, weekend coverage, and a dedicated Slack escalation channel.",
    price: "$399",
    priceUnit: "/mo per portfolio",
  },
  {
    name: "Quarterly strategy session",
    description:
      "90-minute working session with our team to review attribution data, paid mix, creative performance, and the next quarter's plan.",
    price: "$750",
    priceUnit: "per session",
  },
  {
    name: "Co-marketing video shoot",
    description:
      "On-site shoot for property tour video, resident testimonial, or amenity highlight reel. Delivered as ad-ready cuts for Meta + Google.",
    price: "$2,500",
    priceUnit: "per shoot",
  },
];

const GROUPS: Array<{ title: string; subtitle: string; items: AddOn[] }> = [
  {
    title: "Capacity",
    subtitle: "Pay only when you outgrow the plan caps.",
    items: CAPACITY,
  },
  {
    title: "Capability",
    subtitle: "Add capabilities without changing tier.",
    items: CAPABILITY,
  },
  {
    title: "Service",
    subtitle: "Buy more of our team's time when you need it.",
    items: SERVICE,
  },
];

export function AddonsGrid() {
  return (
    <section
      style={{
        backgroundColor: "#faf9f5",
        borderTop: "1px solid #f0eee6",
        borderBottom: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">Add-ons</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Tune the plan to your portfolio.
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
            Every add-on works on any tier. Capacity add-ons are usage-billed,
            so you only pay when you exceed the plan caps. Capability and
            service add-ons are flat monthly or one-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-5">
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#2563EB",
                    fontWeight: 600,
                  }}
                >
                  {g.title}
                </div>
                <p
                  className="mt-1"
                  style={{
                    color: "#5e5d59",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13.5px",
                    lineHeight: 1.5,
                  }}
                >
                  {g.subtitle}
                </p>
              </div>
              <ul className="space-y-3">
                {g.items.map((item) => (
                  <li
                    key={item.name}
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e8e6dc",
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <h3
                        style={{
                          color: "#141413",
                          fontFamily: "var(--font-sans)",
                          fontSize: "14.5px",
                          fontWeight: 600,
                          letterSpacing: "-0.008em",
                        }}
                      >
                        {item.name}
                      </h3>
                      <div className="text-right shrink-0">
                        <div
                          style={{
                            color: "#141413",
                            fontFamily: "var(--font-sans)",
                            fontSize: "14.5px",
                            fontWeight: 700,
                            letterSpacing: "-0.008em",
                          }}
                        >
                          {item.price}
                        </div>
                        {item.priceUnit ? (
                          <div
                            style={{
                              color: "#88867f",
                              fontFamily: "var(--font-sans)",
                              fontSize: "11px",
                            }}
                          >
                            {item.priceUnit}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p
                      style={{
                        color: "#5e5d59",
                        fontFamily: "var(--font-sans)",
                        fontSize: "12.5px",
                        lineHeight: 1.55,
                      }}
                    >
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
