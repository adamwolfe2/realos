import React from "react";

// ---------------------------------------------------------------------------
// TrustStrip — the homepage's stat band, extracted from the hero.
//
// Deslop pass (2026-07-21): hero discipline caps the hero at headline,
// subhead, and CTAs. The three-stat trust strip that used to sit inside
// the hero column now renders as its own compact band directly below it,
// on the same white background with a single hairline separator (no
// background alternation needed since the hero above it is also white).
// ---------------------------------------------------------------------------

type TrustItem = { value: string; label: string };

const TRUST: TrustItem[] = [
  { value: "14 days", label: "Live on your domain" },
  { value: "100%", label: "Ad spend tracked to lease" },
  { value: "$0", label: "Pilot. No commitment." },
];

export function TrustStrip() {
  return (
    <section style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #e0e0e0" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-8 md:py-10">
        <div className="grid grid-cols-3 gap-4 md:gap-10 max-w-[720px] mx-auto">
          {TRUST.map((t, i) => (
            <div
              key={t.value}
              className={i > 0 ? "pl-4 md:pl-8 text-center border-l" : "text-center"}
              style={i > 0 ? { borderColor: "#e0e0e0" } : undefined}
            >
              <p
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(18px, 2.4vw, 24px)",
                  fontWeight: 500,
                  lineHeight: 1.05,
                  letterSpacing: "-0.005em",
                }}
              >
                {t.value}
              </p>
              <p
                className="mt-1.5"
                style={{
                  color: "#8d8d8d",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  lineHeight: 1.35,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 500,
                }}
              >
                {t.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
