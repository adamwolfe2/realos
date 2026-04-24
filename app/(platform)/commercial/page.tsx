import type { Metadata } from "next";
import Link from "next/link";
import { SplitHero } from "@/components/platform/split-hero";
import { Reveal } from "@/components/platform/reveal";

export const metadata: Metadata = {
  title: "Commercial real estate marketing, in build",
  description:
    "Commercial-first modules are in build, office, retail, industrial, flex space, and medical office. Get on the design-partner list.",
};

const MODULES = [
  { key: "office",     title: "Office leasing",          status: "design partner · Q3", body: "Tenant rep outreach, tour scheduling, sublease mapping, VTS handoff."   },
  { key: "retail",     title: "Retail & restaurant",     status: "design partner · Q3", body: "Foot-traffic analytics, co-tenant matching, concept pitch collateral." },
  { key: "industrial", title: "Industrial & flex",       status: "design partner · Q4", body: "Bay specs, dock-door counts, loading specs, 3PL-ready listings."       },
  { key: "medical",    title: "Medical office",          status: "design partner · Q4", body: "Specialty match, hospital-proximity targeting, HIPAA-safe intake."    },
];

export default function CommercialPage() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <SplitHero
        eyebrow="Commercial real estate"
        headline="Commercial is"
        headlineAccent="in build."
        subhead="The platform is live for residential operators today: student housing, multifamily, and senior living. Commercial modules ship next: office, retail, industrial, flex space, and medical office. Five design-partner spots open."
        ctas={[
          { label: "Apply as a design partner", href: "/onboarding" },
          { label: "See the residential platform", href: "/residential", variant: "secondary" },
        ]}
        caption="First five partners shape the spec · priced below GA · shipping this year"
        artifact={<RoadmapCard />}
      />

      <section style={{ backgroundColor: "#faf9f5" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p
                className="mb-4"
                style={{
                  color: "#87867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                What's shipping
              </p>
              <h2
                className="mx-auto max-w-[720px]"
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 3.4vw, 40px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                }}
              >
                Four commercial surfaces. Built with partners.
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
                    borderRadius: "16px",
                    boxShadow: "0 0 0 1px #f0eee6",
                  }}
                >
                  <p
                    style={{
                      color: "#2563EB",
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
                      color: "#141413",
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
                      color: "#5e5d59",
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

      <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <Reveal>
            <p
              className="mb-6"
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Five design-partner spots
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h2
              className="mx-auto max-w-[780px]"
              style={{
                color: "#141413",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px, 3.2vw, 38px)",
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: "-0.008em",
              }}
            >
              Partners shape the spec, lock in below-GA pricing, and ship first. Then the platform opens.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/onboarding" className="btn-primary">
                Apply as a partner
              </Link>
              <Link href="/residential" className="btn-secondary">
                See it on residential
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
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #f0eee6, 0 20px 60px rgba(20,20,19,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 md:px-6 py-4 flex items-center justify-between gap-3"
        style={{ borderBottom: "1px solid #f0eee6", backgroundColor: "#faf9f5" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#87867f",
            fontWeight: 600,
          }}
        >
          What's shipping and when
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#2563EB",
            fontWeight: 600,
          }}
        >
          5 / 5 partner spots
        </span>
      </div>

      <ul>
        {rows.map((r, i) => (
          <li
            key={r.q}
            className="flex items-center gap-3 px-5 md:px-6 py-3.5"
            style={{
              borderBottom: i < rows.length - 1 ? "1px solid #f0eee6" : "none",
            }}
          >
            <StatusDot status={r.status} />
            <span
              className="flex-1 min-w-0 truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: "#141413",
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
                color: "#87867f",
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

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    live:     { bg: "#3a7d44", label: "live"     },
    opening:  { bg: "#2563EB", label: "opening"  },
    building: { bg: "#b8860b", label: "building" },
    planned:  { bg: "#b0aea5", label: "planned"  },
  };
  const s = map[status] ?? map.planned;
  return (
    <span className="inline-flex items-center gap-2 flex-shrink-0">
      <span
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
