import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { AuditForm } from "@/components/audit/audit-form";

export const metadata: Metadata = {
  title: `Free property marketing audit | ${BRAND_NAME}`,
  description:
    "See how AI-powered renters actually find your properties. Free 60-second SEO, AI-search, and reputation audit — real data, no credit card.",
  alternates: { canonical: "/audit" },
  robots: { index: true, follow: true },
};

export default function AuditFormPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <section className="relative">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span
                aria-hidden
                className="hidden sm:inline-block"
                style={{ width: 28, height: 1, backgroundColor: "#2563EB" }}
              />
              <p
                className="text-[11px] font-mono uppercase tracking-[0.18em]"
                style={{
                  color: "#2563EB",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Free audit · 60 seconds
              </p>
              <span
                aria-hidden
                className="hidden sm:inline-block"
                style={{ width: 28, height: 1, backgroundColor: "#2563EB" }}
              />
            </div>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight"
              style={{ color: "#1E2A3A" }}
            >
              See how AI-powered renters actually find your properties.
            </h1>
            <p
              className="mt-5 text-lg md:text-xl leading-relaxed mx-auto max-w-2xl"
              style={{ color: "#4B5563" }}
            >
              Run a free 60-second audit. Real data on your SEO, AI search
              visibility, and online reputation — across every major engine
              and review site.
            </p>
            <div className="mt-8">
              <AuditForm />
            </div>
          </div>

          <ul className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <TrustItem
              title="Powered by DataForSEO + Claude + Tavily"
              body="The same provider stack the LeaseStack platform runs in production."
            />
            <TrustItem
              title="Used by Telegraph Commons"
              body="Quietly running on real properties before this lived on a public page."
            />
            <TrustItem
              title="No credit card. Email-gated."
              body="See your top-line score immediately. Drop your email for the full report."
            />
          </ul>
        </div>
      </section>
    </div>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <li
      className="rounded-xl border p-4"
      style={{ borderColor: "#E5E7EB", backgroundColor: "#FBFBFD" }}
    >
      <p className="text-sm font-medium" style={{ color: "#1E2A3A" }}>
        {title}
      </p>
      <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
        {body}
      </p>
    </li>
  );
}
