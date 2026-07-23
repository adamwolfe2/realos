import Link from "next/link";
import { WeeklyReport } from "@/components/platform/artifacts/weekly-report";
import { ProductFrame } from "./product-frame";
import { FrameSettle } from "./frame-settle";
import { Reveal } from "@/components/platform/reveal";
import { SectionShell, LabelChip } from "./section-shell";
import { Mark } from "./mark";

// ---------------------------------------------------------------------------
// ReportFeature — [04] The report. The weekly report your owners actually
// read, on a soft blue texture panel (juicebox J4) with a faint oversize
// "7:00 AM Monday" watermark, shown in the physical frame with a perspective
// settle and contact glow (depth addendum sec 5). Headline carries a marker +
// ruler (cool pass M1; motion pass sec 5).
//
// The WeeklyReport artifact is a shared client component; per scope its
// internal top-down "assemble" is carried by the frame settle + a spring/fade
// "Delivered Monday 7:00 AM" chip rather than editing the artifact.
// ---------------------------------------------------------------------------

const PANEL_TEXTURE =
  "repeating-linear-gradient(45deg, rgba(15,98,254,0.05) 0, rgba(15,98,254,0.05) 1px, transparent 1px, transparent 11px)";

export function ReportFeature() {
  return (
    <SectionShell bg="#FFFFFF">
      <div className="py-24 md:py-28">
        <div
          className="relative overflow-hidden"
          style={{
            backgroundColor: "#eef3ff",
            backgroundImage: PANEL_TEXTURE,
            border: "1px solid #e0e6f4",
            borderRadius: 4,
            padding: "56px 20px",
          }}
        >
          <div className="relative text-center">
            <Reveal>
              <div className="flex justify-center">
                <LabelChip>Operating rhythm</LabelChip>
              </div>
              <h2
                className="mt-4"
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(28px, 3.6vw, 44px)",
                  fontWeight: 500,
                  lineHeight: 1.1,
                  letterSpacing: "-0.025em",
                }}
              >
                It lands <Mark ruler>every Monday</Mark> at 7am.
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

            <FrameSettle className="mt-12 mx-auto max-w-[880px]">
              <ProductFrame url="app.leasestack.co/reports">
                <WeeklyReport />
              </ProductFrame>
            </FrameSettle>

            <Reveal delay={200}>
              <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
                <span
                  className="inline-flex items-center"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #e0e6f4",
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    color: "#0f43b8",
                  }}
                >
                  Delivered Monday 7:00 AM
                </span>
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
            </Reveal>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
