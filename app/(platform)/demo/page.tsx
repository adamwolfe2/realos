import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `See ${BRAND_NAME} in action`,
  description:
    "A five-minute walkthrough of the platform: admin dashboard, tenant portal, tenant marketing site. Then book a live demo if the shoe fits.",
};

export default function DemoPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Product demo
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            Watch first. Book second.
          </h1>
          <p
            className="mt-6 font-mono text-sm md:text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--text-body)" }}
          >
            Five-minute walkthrough of the agency admin, client portal, and the
            tenant marketing site we ship per client. When you're ready for a
            live demo on your stack, book from the button below.
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16">
          <div
            className="aspect-video bg-white flex items-center justify-center"
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "14px",
            }}
          >
            <p
              className="font-mono text-xs uppercase tracking-[0.18em] text-center max-w-sm px-6"
              style={{ color: "var(--text-muted)" }}
            >
              Loom walkthrough ships week of launch. Until then the best demo
              is a live one.
            </p>
          </div>
          <div
            className="mt-8 p-10 text-center"
            style={{
              backgroundColor: "var(--bg-blue-dark)",
              borderRadius: "14px",
              color: "white",
            }}
          >
            <h2 className="font-serif text-2xl md:text-3xl font-normal">
              30 minutes on Zoom.
            </h2>
            <p
              className="font-mono text-sm leading-relaxed mt-3 max-w-xl mx-auto"
              style={{ opacity: 0.85 }}
            >
              We audit your current marketing stack live on the call.
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
