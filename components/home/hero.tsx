import Link from "next/link";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SectionShell } from "./section-shell";
import { Atmosphere } from "./atmosphere";
import { Mark } from "./mark";
import { SignalFlow } from "./signal-flow";

// ---------------------------------------------------------------------------
// Hero — [01] Capture. Confident light typography over the signature signal-
// flow diagram (cool pass M2 executed light per "no dark ever"; motion pass
// sec 1). Headline keyword carries a marker highlight that sweeps in with a
// drawn ruler. The real product appears in the next section.
// ---------------------------------------------------------------------------

export function Hero() {
  return (
    <SectionShell index="01" indexLabel="A renter shows intent" bg="#FFFFFF">
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

        <div className="relative">
          <h1
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
            <Mark ruler>One system.</Mark>
          </h1>

          <p
            className="mt-6 md:mt-7"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
              maxWidth: "560px",
            }}
          >
            LeaseStack unifies marketing, leasing, and reputation data into one
            dashboard your whole team runs on.
          </p>

          <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center gap-3">
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

          <div className="mt-12 md:mt-14">
            <SignalFlow />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
