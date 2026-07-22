import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { WeeklyReport } from "@/components/platform/artifacts/weekly-report";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";

// ---------------------------------------------------------------------------
// /sample-report — public sample of the Monday-morning weekly email.
//
// Why this exists (2026-05-29): CapabilitiesRail capability 01 ("Weekly
// report that writes itself") used to link to `#product-tour` because no
// dedicated sample existed yet. That anchor jumped the user to the
// dashboard tour instead of showing them the actual report artifact, so
// the CTA underdelivered.
//
// This route renders the WeeklyReport artifact at full bleed, with
// contextual annotations under each section explaining what the operator
// is looking at and how it was assembled. Reuses the same artifact the
// capabilities rail shows on hover so the content stays in sync.
// ---------------------------------------------------------------------------

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const BORDER = "#E2E8F0";
const MUTED = "#64748B";

export const metadata: Metadata = {
  title: `Sample weekly report | ${BRAND_NAME}`,
  description:
    "What lands in your inbox at 7am every Monday: leases attributed to source, channel ROI, anomaly flags, and three concrete actions for the week.",
};

const ANNOTATIONS = [
  {
    eyebrow: "Header",
    title: "From your dashboard, not a marketing automation",
    body: "Subject line names the property and the week. From-line is your portal, not a generic agency domain. Operators forward it to ownership without re-formatting. Norman Gensinger at SG asked for this specifically.",
  },
  {
    eyebrow: "Leases attributed",
    title: "Every signed lease mapped to a source",
    body: "Google Ads, Meta, organic search, referral, direct: drawn from the pixel, UTM, and PMS join. No more guessing which channel paid for the renewal. Shares are shown by lease count, not by impression or click, because that's the only number ownership cares about.",
  },
  {
    eyebrow: "Three actions",
    title: "The shortest possible action list",
    body: "Three actions, ranked by dollar impact. \"Shift $600 from Meta to Google. Google CPL is $48; Meta is $112 this cycle.\" Exact dollar moves, not strategy bullets. The platform writes them; you approve or override.",
  },
  {
    eyebrow: "Anomalies",
    title: "Only the things that broke",
    body: "Tour-booking rate fell on weekends → flagged. Creative CTR down 32% → flagged. Steady-state weeks have no anomaly section at all. We refuse to invent reasons to email you.",
  },
];

export default function SampleReportPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      {/* Hero — single column, mirrors /audit + /pricing rhythm */}
      <section style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <p
            style={{
              color: ACCENT,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Sample report
          </p>
          <h1
            className="mt-5"
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(36px, 5.4vw, 68px)",
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.028em",
            }}
          >
            What lands in your inbox at 7am Monday.
          </h1>
          <p
            className="mt-6 mx-auto max-w-2xl"
            style={{
              color: MUTED,
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              lineHeight: 1.55,
            }}
          >
            Leases attributed to source, channel ROI, anomalies flagged,
            three actions ranked by dollar impact. Read over coffee every
            Monday.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/audit"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Run a free audit
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold border"
              style={{
                borderColor: BORDER,
                color: INK,
                backgroundColor: "#FFFFFF",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Live artifact — full-bleed render of the actual WeeklyReport
          component used in CapabilitiesRail. Wrapped in a SoftFramedArtifact
          for the same visual treatment customers see on the homepage. */}
      <section style={{ backgroundColor: "#f4f4f4" }}>
        <div className="max-w-[960px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <SoftFramedArtifact tone="sky" padding="lg" bare>
            <WeeklyReport />
          </SoftFramedArtifact>
          <p
            className="mt-6 text-center"
            style={{
              color: MUTED,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            The numbers in this sample are illustrative. Your real report
            is built from your live pixel, ad, and PMS data.
          </p>
        </div>
      </section>

      {/* Annotation grid — each section of the report explained */}
      <section>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="max-w-2xl">
            <h2
              style={{
                color: INK,
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(28px, 3.6vw, 44px)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              Every block above, explained.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {ANNOTATIONS.map((a) => (
              <article
                key={a.eyebrow}
                className="rounded-2xl border p-6 md:p-8"
                style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}
              >
                <p
                  style={{
                    color: ACCENT,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {a.eyebrow}
                </p>
                <h3
                  className="mt-3"
                  style={{
                    color: INK,
                    fontFamily: "var(--font-sans)",
                    fontSize: 20,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {a.title}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    color: MUTED,
                    fontFamily: "var(--font-sans)",
                    fontSize: 15,
                    lineHeight: 1.6,
                  }}
                >
                  {a.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{
          borderTop: `1px solid ${BORDER}`,
          backgroundColor: "#f4f4f4",
        }}
      >
        <div className="max-w-[900px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <h2
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.022em",
            }}
          >
            Want this for your property next Monday?
          </h2>
          <p
            className="mt-5 mx-auto max-w-xl"
            style={{
              color: MUTED,
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              lineHeight: 1.55,
            }}
          >
            Start with a free audit. It runs against your live domain and
            comes back with the same kind of read inside an hour, no card
            required.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/audit"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Run a free audit
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold border"
              style={{
                borderColor: BORDER,
                color: INK,
                backgroundColor: "#FFFFFF",
              }}
            >
              Back to overview
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
