import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";

export function Proof() {
  const { proof, final } = MARKETING.home;

  return (
    <section style={{ backgroundColor: "#1E2A3A", color: "#FFFFFF" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl">
          <p
            style={{
              color: "#60A5FA",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            The platform
          </p>
          <h2
            className="mt-4"
            style={{
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            {proof.heading}
          </h2>
          <p
            className="mt-5 max-w-[640px]"
            style={{
              color: "rgba(255,255,255,0.7)",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
            }}
          >
            {proof.body}
          </p>
        </div>

        <div
          className="mt-16 grid grid-cols-1 md:grid-cols-3"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.12)",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <StatCell
            value="14"
            label="Days from intake call to live on your domain."
            divider
          />
          <StatCell
            value="1"
            label="Login. Not six vendors, six invoices, six dashboards."
            divider
          />
          <StatCell
            value="0"
            label="Long-term contracts. Month-to-month after launch."
          />
        </div>

        <div className="mt-12 md:mt-14 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="max-w-[560px]">
            <p
              style={{
                color: "#F59E0B",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Pilot cohort &middot; open now
            </p>
            <h3
              className="mt-3"
              style={{
                color: "#FFFFFF",
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(22px, 2.4vw, 28px)",
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.015em",
              }}
            >
              {final.heading}
            </h3>
            <p
              className="mt-3"
              style={{
                color: "rgba(255,255,255,0.65)",
                fontFamily: "var(--font-sans)",
                fontSize: "15.5px",
                lineHeight: 1.6,
              }}
            >
              {final.body}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <Link
              href={final.primaryHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "48px",
                padding: "12px 24px",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "3px",
                textDecoration: "none",
                letterSpacing: "-0.005em",
                transition: "background-color 0.2s ease",
              }}
            >
              {final.primaryCta}
            </Link>
            <Link
              href="/demo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "48px",
                padding: "12px 24px",
                backgroundColor: "transparent",
                color: "#FFFFFF",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "3px",
                textDecoration: "none",
                letterSpacing: "-0.005em",
                border: "1px solid rgba(255,255,255,0.3)",
                transition: "background-color 0.2s ease",
              }}
            >
              See the data
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCell({
  value,
  label,
  divider,
}: {
  value: string;
  label: string;
  divider?: boolean;
}) {
  return (
    <div
      className="py-10 md:py-12 md:px-8"
      style={{
        borderRight: divider ? "1px solid rgba(255,255,255,0.12)" : "none",
      }}
    >
      <p
        style={{
          color: "#FFFFFF",
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(56px, 7vw, 88px)",
          fontWeight: 700,
          lineHeight: 0.95,
          letterSpacing: "-0.035em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      <p
        className="mt-4 max-w-[240px]"
        style={{
          color: "rgba(255,255,255,0.65)",
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          lineHeight: 1.5,
        }}
      >
        {label}
      </p>
    </div>
  );
}
