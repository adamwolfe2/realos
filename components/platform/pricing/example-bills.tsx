// Example bills — turns abstract pricing into "here's what your invoice
// looks like." Norman and James (the buyers) both think in portfolio
// units, not per-property line items. This section shows three concrete
// invoice scenarios so they can map their own portfolio onto the math
// without us doing it on a sales call.

type Scenario = {
  name: string;
  audience: string;
  lines: Array<{ label: string; value: string; sub?: string }>;
  monthlyTotal: string;
  setupTotal: string;
  year1Total: string;
  highlighted: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    name: "1 property, just launched",
    audience: "Owner-operator getting started",
    highlighted: false,
    lines: [
      {
        label: "Foundation",
        value: "$599",
        sub: "× 1 property",
      },
      {
        label: "Setup fee (one-time)",
        value: "$1,500",
        sub: "billed at signing",
      },
    ],
    monthlyTotal: "$599 /mo",
    setupTotal: "$1,500 setup",
    year1Total: "≈ $8,688 /yr + $1,500 setup",
  },
  {
    name: "3 properties, growing",
    audience: "Mid-market operator running paid ads",
    highlighted: true,
    lines: [
      {
        label: "Growth × 1 property",
        value: "$899",
      },
      {
        label: "Growth × 2 additional properties",
        value: "$1,438",
        sub: "20% off · $719 each",
      },
      {
        label: "Ad spend management",
        value: "$450",
        sub: "15% on $3,000/mo ads",
      },
      {
        label: "Setup fees (one-time)",
        value: "$7,500",
        sub: "$2,500 × 3 properties",
      },
    ],
    monthlyTotal: "$2,787 /mo",
    setupTotal: "$7,500 setup",
    year1Total: "≈ $40,944 /yr + $7,500 setup",
  },
  {
    name: "10 properties, full stack",
    audience: "Portfolio operator pushing scale",
    highlighted: false,
    lines: [
      {
        label: "Scale × 1 property",
        value: "$1,199",
        sub: "10+ property volume rate",
      },
      {
        label: "Scale × 9 additional",
        value: "$8,633",
        sub: "20% off · $959 each",
      },
      {
        label: "Ad spend management",
        value: "$1,200",
        sub: "15% on $8,000/mo ads",
      },
      {
        label: "White-label portal",
        value: "$499",
      },
      {
        label: "Setup fees (one-time)",
        value: "$35,000",
        sub: "$3,500 × 10 properties",
      },
    ],
    monthlyTotal: "$11,531 /mo",
    setupTotal: "$35,000 setup",
    year1Total: "≈ $173,376 /yr + $35,000 setup",
  },
];

export function ExampleBills() {
  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">What you'd actually pay</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Three sample invoices.
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
            Map your portfolio onto one of these and you've got your number.
            The middle column is where ~60% of our customers land.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {SCENARIOS.map((s) => (
            <div
              key={s.name}
              className="rounded-2xl p-6 flex flex-col"
              style={{
                backgroundColor: s.highlighted ? "#ffffff" : "#faf9f5",
                border: s.highlighted
                  ? "1px solid #2563EB"
                  : "1px solid #e8e6dc",
                boxShadow: s.highlighted
                  ? "0 0 0 4px rgba(37,99,235,0.10), 0 8px 24px rgba(20,20,19,0.05)"
                  : "0 1px 2px rgba(20,20,19,0.02)",
              }}
            >
              <div className="mb-4">
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: s.highlighted ? "#2563EB" : "#88867f",
                    fontWeight: 600,
                  }}
                >
                  {s.audience}
                </div>
                <h3
                  className="mt-1"
                  style={{
                    color: "#141413",
                    fontFamily: "var(--font-sans)",
                    fontSize: "18px",
                    fontWeight: 600,
                    letterSpacing: "-0.012em",
                  }}
                >
                  {s.name}
                </h3>
              </div>

              {/* Invoice lines — slight monospace feel for numbers */}
              <ul className="space-y-2.5 mb-5 flex-1">
                {s.lines.map((line, idx) => (
                  <li
                    key={idx}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div
                        style={{
                          color: "#4d4c48",
                          fontFamily: "var(--font-sans)",
                          fontSize: "13.5px",
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {line.label}
                      </div>
                      {line.sub ? (
                        <div
                          style={{
                            color: "#88867f",
                            fontFamily: "var(--font-sans)",
                            fontSize: "11.5px",
                            marginTop: "1px",
                          }}
                        >
                          {line.sub}
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        color: "#141413",
                        fontFamily: "var(--font-sans)",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {line.value}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Totals — visually separated so the headline sticks. */}
              <div
                style={{
                  borderTop: "1px solid #e8e6dc",
                  paddingTop: "14px",
                }}
              >
                <div
                  className="flex items-baseline justify-between mb-1"
                  style={{
                    color: "#141413",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    fontWeight: 700,
                    letterSpacing: "-0.008em",
                  }}
                >
                  <span>Recurring</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {s.monthlyTotal}
                  </span>
                </div>
                <div
                  className="flex items-baseline justify-between"
                  style={{
                    color: "#5e5d59",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                  }}
                >
                  <span>One-time</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {s.setupTotal}
                  </span>
                </div>
                <div
                  className="mt-3 pt-3"
                  style={{
                    borderTop: "1px dashed #e8e6dc",
                    color: "#2563EB",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {s.year1Total}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
