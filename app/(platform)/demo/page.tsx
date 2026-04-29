import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { ProductTour } from "@/components/product-tour";

export const metadata: Metadata = {
  title: `See ${BRAND_NAME} in action`,
  description:
    "A live, clickable walkthrough of the platform: admin dashboard, tenant portal, tenant marketing site. Then book a 1:1 demo if the shoe fits.",
};

export default function DemoPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Live product walkthrough
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            See {BRAND_NAME} in action
          </h1>
          <p
            className="mt-6 font-mono text-sm md:text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--text-body)" }}
          >
            Click around the actual portal. Same surfaces your team will use day-to-day.
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16">
          <div className="hidden md:block">
            <ProductTour />
          </div>

          <div
            className="md:hidden p-8 text-center"
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "14px",
              backgroundColor: "white",
            }}
          >
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Best on desktop
            </p>
            <h2
              className="font-serif text-2xl font-normal mb-4"
              style={{ color: "var(--text-headline)" }}
            >
              The {BRAND_NAME} tour is built for a wider screen.
            </h2>
            <p
              className="font-mono text-sm leading-relaxed mb-6 max-w-md mx-auto"
              style={{ color: "var(--text-body)" }}
            >
              Open this page on a desktop to click through the live walkthrough,
              or book a 1:1 demo and we'll share screen with you.
            </p>
            <Link
              href="/onboarding"
              className="inline-block font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                backgroundColor: "var(--bg-blue-dark)",
                color: "white",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Book a 1:1 demo
            </Link>
          </div>

          <div
            className="mt-12 p-6 md:p-10 text-center"
            style={{
              backgroundColor: "var(--bg-blue-dark)",
              borderRadius: "14px",
              color: "white",
            }}
          >
            <h2 className="font-serif text-2xl md:text-3xl font-normal">
              Prefer a live walkthrough?
            </h2>
            <p
              className="font-mono text-sm leading-relaxed mt-3 max-w-xl mx-auto"
              style={{ opacity: 0.85 }}
            >
              30 minutes on Zoom. We audit your current marketing stack live on the call.
            </p>
            <Link
              href="/onboarding"
              className="mt-6 inline-block font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                backgroundColor: "white",
                color: "var(--bg-blue-dark)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Book a live demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
