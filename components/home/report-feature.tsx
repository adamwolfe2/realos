import Link from "next/link";
import { WeeklyReport } from "@/components/platform/artifacts/weekly-report";
import { ProductFrame } from "./product-frame";
import { Reveal } from "@/components/platform/reveal";

// ---------------------------------------------------------------------------
// ReportFeature — the centerpiece (2026-07-21 blueprint, section 5). The
// weekly report your owners actually read, shown large and centered inside
// the same browser frame as the product hero shot. One CTA to a full
// sample report (a distinct intent from the pilot / demo pair).
// ---------------------------------------------------------------------------

export function ReportFeature() {
  return (
    <section style={{ backgroundColor: "#f4f4f4" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 text-center">
        <Reveal>
          <h2
            style={{
              color: "#161616",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            It lands every Monday at 7am.
          </h2>
          <p
            className="mt-4 mx-auto"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
              maxWidth: "480px",
            }}
          >
            The report your owners actually read.
          </p>
        </Reveal>

        <Reveal delay={120} y={24}>
          <div className="mt-12 mx-auto max-w-[880px]">
            <ProductFrame url="app.leasestack.co/reports">
              <WeeklyReport />
            </ProductFrame>
          </div>
        </Reveal>

        <div className="mt-8">
          <Link
            href="/sample-report"
            className="inline-flex items-center gap-1.5 group"
            style={{
              color: "#0f62fe",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            See a sample report
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="transition-transform group-hover:translate-x-1"
              aria-hidden
            >
              <path
                d="M3 7h7m0 0L7 4m3 3L7 10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
