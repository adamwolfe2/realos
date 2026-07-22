import React from "react";
import { Fingerprint } from "lucide-react";
import { Eyebrow, WCard, INK, MUTED, FAINT, BORDER, BRAND, UP } from "./shell";

// Replica of the Visitors screen (app/portal/visitors/page.tsx): anonymous
// website traffic resolved to a name + intent by the pixel. 312 identified
// this month (41% of traffic named).

const VISITORS = [
  { name: "Taylor B.", org: "", intent: "Viewed 3-bed floor plans", pages: 4, source: "Google", when: "6m ago" },
  { name: "Northside Realty", org: "Company", intent: "Pricing + amenities", pages: 7, source: "Direct", when: "22m ago" },
  { name: "Chris D.", org: "", intent: "Application page, twice", pages: 5, source: "Meta", when: "48m ago" },
  { name: "Morgan L.", org: "", intent: "Toured availability calendar", pages: 3, source: "Organic", when: "1h ago" },
  { name: "Beacon Partners", org: "Company", intent: "Compared two properties", pages: 9, source: "Referral", when: "2h ago" },
];

export function ScreenVisitors() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-end justify-between">
        <div>
          <Eyebrow>Visitor identification</Eyebrow>
          <h1 className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Visitors
          </h1>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
          312 identified this month
        </p>
      </div>

      <WCard className="mt-3 flex-1 min-h-0" style={{ padding: 0, overflow: "hidden" }}>
        {VISITORS.map((v, i) => (
          <div
            key={v.name}
            className="flex items-center gap-3"
            style={{ padding: "12px 15px", borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}
          >
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{ width: 30, height: 30, borderRadius: 2, backgroundColor: "rgba(15,98,254,0.08)", color: BRAND }}
            >
              <Fingerprint className="w-4 h-4" strokeWidth={1.7} aria-hidden />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: INK }}>{v.name}</span>
                {v.org ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UP, backgroundColor: "rgba(36,161,72,0.10)", borderRadius: 2, padding: "1px 6px" }}>
                    {v.org}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5" style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: MUTED }}>{v.intent}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: INK, fontVariantNumeric: "tabular-nums" }}>{v.pages} pages</p>
              <p className="mt-0.5" style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: FAINT }}>
                {v.source} · {v.when}
              </p>
            </div>
          </div>
        ))}
      </WCard>
    </div>
  );
}
