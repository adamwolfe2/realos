import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SectionShell } from "./section-shell";
import { Atmosphere } from "./atmosphere";
import { Mark } from "./mark";
import { FrameSettle } from "./frame-settle";
import { ReportSnapshotMock } from "./report-snapshot-mock";
import { IntegrationsStrip } from "./integrations-strip";

// ---------------------------------------------------------------------------
// Hero — landing v3 item 5: the abstract signal-flow diagram is gone. A
// first-time visitor sees the ACTUAL dashboard in the first viewport — KPI
// tiles, the visitor→lease funnel, lead sources, live activity — inside a
// browser frame that settles into place once (no infinite loop). Numbers
// count up and bars grow on first view; below md the readable phone-width
// dashboard rides in the same chrome.
// ---------------------------------------------------------------------------

export function Hero() {
  return (
    <SectionShell bg="#FFFFFF">
      <div className="relative pt-16 md:pt-20 pb-14 md:pb-16">
        {/* Atmosphere + faint blue wash behind the diagram. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #ffffff 0%, #ffffff 40%, #f7f9fe 100%)",
          }}
        />
        <Atmosphere />

        <div className="relative text-center">
          <h1
            className="mx-auto"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              // Landing v3 phone QA (Adam 2026-07-23): H1 fills the hero.
              fontSize: "clamp(46px, 7.4vw, 92px)",
              fontWeight: 550,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              maxWidth: "1020px",
            }}
          >
            Every lead, tour, and lease.
            <br />
            <Mark>One system.</Mark>
          </h1>

          <p
            className="mt-6 md:mt-7 mx-auto"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
              maxWidth: "620px",
            }}
          >
            {MARKETING.home.hero.subhead}
          </p>

          <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="btn-primary sm:w-auto"
              style={{ display: "flex", justifyContent: "center" }}
            >
              Request pilot
            </Link>
            <BookDemoLink
              className="btn-secondary sm:w-auto"
              style={{ display: "flex", justifyContent: "center" }}
            >
              Book a demo
            </BookDemoLink>
          </div>

          {/* Proof strip removed per Adam 2026-07-23 (screenshot: "remove
              this"). The dashboard frame below is the proof now. */}
          {/* Hero visual = the Marketing & Performance Snapshot (Adam
              2026-07-23: "use that report as the main HERO dashboard").
              Same artifact closes the page in ReportFeature — top and
              bottom bookend on one consistent shot. */}
          <div className="mt-10 md:mt-12">
            <FrameSettle>
              <ReportSnapshotMock />
            </FrameSettle>
          </div>

          {/* Integrations — directly under the hero dashboard (Adam
              2026-07-23): right after seeing the product, prove it speaks
              to the stack they already run. */}
          <div className="mt-14 md:mt-16">
            <IntegrationsStrip />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
