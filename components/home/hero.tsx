import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SectionShell } from "./section-shell";
import { Atmosphere } from "./atmosphere";
import { Mark } from "./mark";
import { FrameSettle } from "./frame-settle";
import { DashboardFrame, MobileFrame } from "./walkthrough/dashboard-frame";

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
              fontSize: "clamp(40px, 6.2vw, 72px)",
              fontWeight: 550,
              lineHeight: 1.03,
              letterSpacing: "-0.04em",
              maxWidth: "900px",
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

          {/* Proof strip — real production numbers, not marketing math. Fills
              the former dead band between the CTAs and the diagram with the
              single most credible thing we have: a live tenant. */}
          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "#0f43b8", fontWeight: 600 }}>
              {MARKETING.home.hero.microProof}
            </span>
            {MARKETING.home.hero.proofStats.map((stat) => (
              <span key={stat} className="inline-flex items-center gap-x-3">
                <span aria-hidden style={{ color: "#c9d4ea" }}>
                  ·
                </span>
                <span style={{ color: "#5a647d", fontWeight: 500 }}>{stat}</span>
              </span>
            ))}
          </div>

          <div className="mt-9 md:mt-10">
            <FrameSettle>
              <DashboardFrame beat={1} natural={1040} className="hidden md:block" />
              <MobileFrame beat={1} className="md:hidden" />
            </FrameSettle>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
