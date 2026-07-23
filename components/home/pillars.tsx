import React from "react";
import { SectionShell, LabelChip } from "./section-shell";
import { Mark } from "./mark";
import { CapabilitiesSequence } from "./capabilities-sequence";

// ---------------------------------------------------------------------------
// Pillars — [03]. The three capabilities, now a tabbed product switcher
// (juicebox layer J2) instead of three stacked rows. Keeps the pillar
// content, layered vignette compositions, and motion-pass mini-scenes, which
// replay on tab activation and first view. Intro headline carries a marker
// highlight (cool pass M1).
// ---------------------------------------------------------------------------

export function Pillars() {
  return (
    <SectionShell bg="#FFFFFF">
      <div className="py-24 md:py-28">
        <div className="max-w-[720px]">
          <LabelChip>The platform</LabelChip>
          <h2
            className="mt-4"
            style={{
              color: "#161616",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(30px, 3.8vw, 46px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            The whole leasing funnel, <Mark>accounted for.</Mark>
          </h2>
          <p
            className="mt-5"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
              maxWidth: "560px",
            }}
          >
            Marketing spend, after-hours leads, and public reputation, each
            tracked in the same dashboard your team already logs into.
          </p>
        </div>

        <CapabilitiesSequence />
      </div>
    </SectionShell>
  );
}
