import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: `${BRAND_NAME} is the managed marketing platform for real estate operators. Student housing, multifamily, senior living. One platform, one retainer.`,
};

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            About {BRAND_NAME}
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            We build the infrastructure
            <br />
            <span style={{ color: "var(--blue)" }}>
              independent operators never had.
            </span>
          </h1>
          <p
            className="mt-6 font-mono text-sm md:text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--text-body)" }}
          >
            {BRAND_NAME} is a California-based technology company. We build the
            managed marketing platform independent real estate operators
            deserve. Custom site, live listings, identity pixel, AI chatbot,
            managed ads, and real follow-up. One retainer, no long contracts.
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div>
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Why we exist
            </p>
            <h2
              className="font-serif text-2xl md:text-3xl font-normal leading-snug"
              style={{ color: "var(--text-headline)" }}
            >
              Real estate marketing is stuck on Conversion Logix.
            </h2>
            <p
              className="font-mono text-sm leading-relaxed mt-5"
              style={{ color: "var(--text-body)" }}
            >
              Operators pay $2,600 a month for vanity metrics and PDF reports.
              The chatbot is a scripted FAQ. The pixel doesn't exist. The
              reporting arrives the month after it matters.
            </p>
            <p
              className="font-mono text-sm leading-relaxed mt-4"
              style={{ color: "var(--text-body)" }}
            >
              Meanwhile the national REITs run in-house teams on software
              independent operators can't buy off the shelf. We built that
              off-the-shelf version.
            </p>
          </div>
          <div
            className="p-8 bg-white"
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "12px",
            }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-[0.18em] mb-5"
              style={{ color: "var(--text-muted)" }}
            >
              What we built
            </p>
            <ul className="space-y-3 font-mono text-xs leading-relaxed" style={{ color: "var(--text-body)" }}>
              <li>Managed site on a custom domain, live AppFolio sync.</li>
              <li>Identity graph pixel on every visit. ~50% ID rate typical.</li>
              <li>AI chatbot trained on your live listings.</li>
              <li>Google and Meta ads, 48 hour creative turnaround.</li>
              <li>Lead capture, CRM, and automated nurture sequences.</li>
              <li>Per-tenant dashboard for the client. Master dashboard for us.</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "var(--bg-blue-dark)", color: "white" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ opacity: 0.6 }}
          >
            Our belief
          </p>
          <p className="font-serif text-2xl md:text-3xl font-normal leading-snug max-w-3xl">
            Every operator should spend their time on partnerships, pricing,
            and community. Not on stitching together five vendor dashboards.
            We do the stitching. You run the building.
          </p>
        </div>
      </section>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 text-center">
          <Link
            href="/onboarding"
            className="inline-block font-mono text-xs font-semibold px-6 py-4 rounded"
            style={{
              backgroundColor: "var(--blue)",
              color: "white",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Book a demo
          </Link>
        </div>
      </section>
    </div>
  );
}
