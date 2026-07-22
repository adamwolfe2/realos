import React from "react";
import { SectionShell } from "./section-shell";
import { CountUp } from "./count-up";

// ---------------------------------------------------------------------------
// TrustBand — proof row (blueprint sec 3; depth addendum sec 7; motion sec 3).
// A white band holding an inset tinted panel with four stats; numeric values
// count up on first view. Mono labels under weight-600 display values. Mobile
// collapses to a 2x2 grid.
// ---------------------------------------------------------------------------

type Item =
  | { kind: "num"; to: number; prefix?: string; suffix?: string; label: string }
  | { kind: "text"; value: string; label: string };

const ITEMS: Item[] = [
  { kind: "num", to: 14, suffix: " days", label: "To live on your domain" },
  { kind: "num", to: 100, suffix: "%", label: "Ad spend tracked to lease" },
  { kind: "num", to: 0, prefix: "$", label: "Pilot. No commitment." },
  {
    kind: "text",
    value: "Telegraph Commons",
    label: "Built with operators, Berkeley",
  },
];

const valueStyle: React.CSSProperties = {
  color: "#161616",
  fontFamily: "var(--font-display)",
  fontSize: "clamp(20px, 2.2vw, 26px)",
  fontWeight: 600,
  lineHeight: 1.1,
  letterSpacing: "-0.01em",
};

const labelStyle: React.CSSProperties = {
  color: "#5a647d",
  fontFamily: "var(--font-mono)",
  fontSize: "10.5px",
  lineHeight: 1.4,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: 600,
};

export function TrustBand() {
  return (
    <SectionShell bg="#FFFFFF">
      <div className="py-10">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6"
          style={{
            backgroundColor: "#f7f9fe",
            border: "1px solid #e0e6f4",
            borderRadius: 2,
            padding: "24px 28px",
          }}
        >
          {ITEMS.map((item) => (
            <div key={item.label}>
              {item.kind === "num" ? (
                <p style={valueStyle}>
                  <CountUp
                    to={item.to}
                    prefix={item.prefix}
                    suffix={item.suffix}
                  />
                </p>
              ) : (
                <p style={valueStyle}>{item.value}</p>
              )}
              <p className="mt-2" style={labelStyle}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
