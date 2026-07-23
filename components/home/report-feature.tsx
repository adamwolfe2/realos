import Link from "next/link";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import { FrameSettle } from "./frame-settle";
import { FitScale } from "./fit-scale";
import { Reveal } from "@/components/platform/reveal";
import { SectionShell, LabelChip } from "./section-shell";
import { Mark } from "./mark";
import { SAMPLE_SNAPSHOT, SAMPLE_PROPERTY } from "./report-sample-data";

// ---------------------------------------------------------------------------
// ReportFeature — landing v3 item 1. The email mock is gone; this renders the
// REAL report artifact — the Marketing & Performance Snapshot one-pager the
// product actually generates (components/portal/reports/property-one-pager),
// fed a typed sample snapshot. KPI row, first-touch acquisition with honest
// "not tracked" rows, leasing momentum, renewals-at-risk, reputation bars,
// AI-search visibility, and the live/connecting/not-wired coverage footer —
// all the exact design Adam screenshotted as the target, because it IS that
// component. Monday-7am rides as a chip, not the headline.
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
                The report your <Mark ruler>owners actually read</Mark>.
              </h2>
              <p
                className="mt-4 mx-auto"
                style={{
                  color: "#6f6f6f",
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  lineHeight: 1.6,
                  maxWidth: "560px",
                }}
              >
                One page: leases attributed to source, renewals at risk,
                reputation, AI-search visibility. Forward it to ownership
                as-is. The deck-building hours come back.
              </p>
            </Reveal>

            <FrameSettle className="mt-12 mx-auto max-w-[880px]">
              <div
                className="text-left"
                style={{
                  boxShadow:
                    "0 1px 2px rgba(22,22,22,0.06), 0 24px 48px -16px rgba(15,98,254,0.16), 0 48px 96px -32px rgba(22,22,22,0.14)",
                  borderRadius: 16,
                }}
              >
                <FitScale natural={880}>
                  <PropertyOnePager
                    snapshot={SAMPLE_SNAPSHOT}
                    property={SAMPLE_PROPERTY}
                  />
                </FitScale>
              </div>
            </FrameSettle>
            <p
              className="mt-4"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5a647d",
              }}
            >
              Sample property · illustrative data
            </p>

            <Reveal delay={200}>
              <div className="mt-7 flex items-center justify-center gap-4 flex-wrap">
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
