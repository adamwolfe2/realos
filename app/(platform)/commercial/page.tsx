import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";

export const metadata: Metadata = {
  title: "Commercial real estate leasing data and Audience Sync",
  description:
    "Audience Sync for commercial is live today: verified office, retail, and industrial intent segments pushed to your ad accounts and CRM. Office, retail, industrial, flex, and medical leasing modules are in a limited design-partner pilot.",
};

const MODULES = [
  { key: "audiences",  title: "Audience Sync",           status: "live today",     body: "Verified office, retail, and industrial intent segments pushed to your ad accounts and CRM today. Cross-property targeting with zip and state filters." },
  { key: "office",     title: "Office leasing",          status: "design partner, Q3", body: "Tenant-rep outreach tracked, tour requests captured from spec sheets, sublease mapping surfaced per submarket, VTS handoff in the same workflow."   },
  { key: "retail",     title: "Retail and restaurant",   status: "design partner, Q3", body: "Foot-traffic analytics tied to the trade area, co-tenant matching for the concept, pitch collateral assembled from the deal you are actually doing." },
  { key: "industrial", title: "Industrial and flex",     status: "design partner, Q4", body: "Bay specs, dock-door counts, clear height, and loading detail packaged into 3PL-ready listings the broker can forward in one click."       },
  { key: "medical",    title: "Medical office",          status: "design partner, Q4", body: "Specialty match by submarket, hospital-proximity targeting, HIPAA-safe intake the practice administrator can complete without a callback."    },
];

export default function CommercialPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <SplitHero
        eyebrow="Commercial real estate"
        headline="Commercial leasing data."
        headlineAccent="Audience Sync, live."
        subhead="Verified office, retail, and industrial segments push to your ad accounts and CRM. Full leasing modules ship via design partners."
        ctas={[
          { label: "Apply as a design partner", href: "/onboarding" },
          { label: "See the residential platform", href: "/residential", variant: "secondary" },
        ]}
        caption="Attribution that survives a six-month sales process."
        artifact={<RoadmapCard />}
      />

      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <h2
                className="mx-auto max-w-[720px]"
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              >
                Five commercial surfaces. Built with the operators using them.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODULES.map((m, i) => (
              <Reveal key={m.key} delay={i * 80}>
                <div
                  className="p-7 h-full"
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "2px",
                    boxShadow: "0 0 0 1px #e0e0e0",
                  }}
                >
                  <p
                    style={{
                      color: "#0f62fe",
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {m.status}
                  </p>
                  <h3
                    className="mt-3"
                    style={{
                      color: "#161616",
                      fontFamily: "var(--font-display)",
                      fontSize: "22px",
                      fontWeight: 500,
                      lineHeight: 1.25,
                    }}
                  >
                    {m.title}
                  </h3>
                  <p
                    className="mt-3"
                    style={{
                      color: "#6f6f6f",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14.5px",
                      lineHeight: 1.6,
                    }}
                  >
                    {m.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[780px]"
              style={{
                color: "#161616",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px, 3.2vw, 38px)",
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: "-0.008em",
              }}
            >
              Design partners shape the spec, lock in below-GA pricing, and ship first. Then the platform opens.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/onboarding" className="btn-primary">
                Apply as a design partner
              </Link>
              <Link href="/residential" className="btn-secondary">
                See the residential platform
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function RoadmapCard() {
  const rows = [
    { q: "Today",      label: "Residential platform live",  status: "live"     },
    { q: "Next month", label: "Commercial design partners", status: "opening"  },
    { q: "Q3",         label: "Office + retail ship",       status: "building" },
    { q: "Q4",         label: "Industrial + medical ship",  status: "planned"  },
    { q: "2027",       label: "General availability",       status: "planned"  },
  ];
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "2px",
        boxShadow: "0 0 0 1px #e0e0e0, 0 20px 60px rgba(15,23,42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 md:px-6 py-4 flex items-center justify-between gap-3"
        style={{ borderBottom: "1px solid #e0e0e0", backgroundColor: "#f4f4f4" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8d8d8d",
            fontWeight: 600,
          }}
        >
          What's shipping and when
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#0f62fe",
            fontWeight: 600,
          }}
        >
          Design-partner pilot
        </span>
      </div>

      <ul>
        {rows.map((r, i) => (
          <li
            key={r.q}
            className="flex items-center gap-3 px-5 md:px-6 py-3.5"
            style={{
              borderBottom: i < rows.length - 1 ? "1px solid #e0e0e0" : "none",
            }}
          >
            <StatusDot status={r.status} />
            <span
              className="flex-1 min-w-0 truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: "#161616",
                fontWeight: 500,
              }}
            >
              {r.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8d8d8d",
                fontWeight: 600,
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              {r.q}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// StatusDot: a real per-row status indicator (each row tracks a distinct
// roadmap milestone), not a decorative chip. Colors: green = shipped,
// blue = opening now, amber = building, gray = planned.
function StatusDot({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    live:     { bg: "#24a148", label: "live"     },
    opening:  { bg: "#0f62fe", label: "opening"  },
    building: { bg: "#f1c21b", label: "building" },
    planned:  { bg: "#8d8d8d", label: "planned"  },
  };
  const s = map[status] ?? map.planned;
  return (
    <span className="inline-flex items-center gap-2 flex-shrink-0">
      <span
        aria-hidden="true"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: s.bg,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: s.bg,
          fontWeight: 600,
          minWidth: "66px",
        }}
      >
        {s.label}
      </span>
    </span>
  );
}
