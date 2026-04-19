import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Commercial real estate marketing, in build",
  description:
    "Commercial-first modules are in build, office, retail, industrial, flex space, and medical office. Get on the design-partner list.",
};

export default function CommercialPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Commercial real estate
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            Commercial is in build.
          </h1>
          <p
            className="mt-6 font-mono text-sm md:text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--text-body)" }}
          >
            The platform is live for residential operators today, student
            housing, multifamily, and senior living. Commercial modules ship
            next: office, retail, industrial, flex space, and medical office.
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["Office leasing", "Retail and restaurant", "Industrial and flex", "Medical office"].map(
              (label) => (
                <div
                  key={label}
                  className="p-6 bg-white"
                  style={{
                    border: "1px solid var(--border-strong)",
                    borderRadius: "10px",
                  }}
                >
                  <p
                    className="font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Module in build
                  </p>
                  <h2
                    className="font-serif text-xl font-semibold mt-2"
                    style={{ color: "var(--text-headline)" }}
                  >
                    {label}
                  </h2>
                </div>
              )
            )}
          </div>

          <div
            className="mt-14 p-10 text-center"
            style={{
              backgroundColor: "var(--bg-blue-dark)",
              borderRadius: "16px",
              color: "white",
            }}
          >
            <h2 className="font-serif text-3xl md:text-4xl font-normal">
              Five design partners.
            </h2>
            <p
              className="font-mono text-sm leading-relaxed mt-4 max-w-xl mx-auto"
              style={{ opacity: 0.85 }}
            >
              We're onboarding five commercial operators as design partners
              ahead of launch. If your portfolio fits, book a call and tell us
              about it.
            </p>
            <Link
              href="/onboarding"
              className="mt-8 inline-block font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                backgroundColor: "white",
                color: "var(--bg-blue-dark)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Apply as a partner
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
