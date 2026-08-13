import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// ReportSpine — "Three things costing you leases."
//
// The narrative spine of the redesigned /audit/[token] report. The top
// recommendations are promoted from card-grid filler to numbered claims:
// plain-English claim, one paragraph of why, competitors named inline,
// the raw evidence collapsed underneath (reusing the existing audit
// section components), and the same closing motion on every item:
// "LeaseStack fixes this → Book 15 min."
//
// Server component. The page assembles the items (including which
// evidence pool each claim gets); this file owns only the presentation.
// ---------------------------------------------------------------------------

export type SpineItem = {
  id: string;
  title: string;
  why: string;
  /** Optional inline note under the why, e.g. named competitors. */
  note?: ReactNode;
  /** Collapsed evidence block. Omit to render claim + CTA only. */
  evidence?: ReactNode;
  evidenceLabel?: string;
  /** Deep-link anchor (e.g. "ai-search" for /ai-visibility). */
  anchorId?: string;
  /** Render the evidence expanded on load (the verdict surface). */
  defaultOpen?: boolean;
};

export function ReportSpine({ items }: { items: SpineItem[] }) {
  if (items.length === 0) return null;

  return (
    <section id="three-things" className="scroll-mt-24">
      <style>{`
        .spn-det > summary { list-style: none; cursor: pointer; }
        .spn-det > summary::-webkit-details-marker { display: none; }
        .spn-chev { transition: transform .35s cubic-bezier(.2,.8,.2,1); }
        .spn-det[open] .spn-chev { transform: rotate(180deg); }
        @keyframes spn-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .spn-det[open] .spn-body { animation: spn-in .45s cubic-bezier(.2,.8,.2,1) both; }
        .spn-cta .spn-arr { display: inline-block; transition: transform .25s cubic-bezier(.2,.8,.2,1); }
        .spn-cta:hover .spn-arr { transform: translateX(3px); }
        @media (prefers-reduced-motion: reduce) {
          .spn-det[open] .spn-body { animation: none; }
          .spn-chev, .spn-cta .spn-arr { transition: none; }
        }
      `}</style>

      <div className="mx-auto max-w-[1080px] px-4 pb-4 pt-14 md:px-6 md:pt-20">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
        >
          The short version
        </p>
        <h2
          className="mt-3"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 550,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: "#161616",
          }}
        >
          {items.length === 1 ? "The thing" : `${COUNT_WORDS[items.length] ?? items.length} things`}{" "}
          <span className="ls-hl px-1.5">costing you leases.</span>
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed" style={{ color: "#525252" }}>
          Everything below comes from live engine responses and public data
          about your property, ranked by impact. The evidence for each is
          one click away.
        </p>

        <ol className="mt-6">
          {items.map((item, i) => (
            <li
              key={item.id}
              id={item.anchorId}
              className="scroll-mt-24 grid grid-cols-1 gap-4 py-10 sm:grid-cols-[64px_1fr] sm:gap-6 md:py-12"
              style={{ borderTop: "1px solid #e0e0e0" }}
            >
              <span
                aria-hidden
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#0f62fe",
                  letterSpacing: "0.04em",
                  paddingTop: 6,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(21px, 2.6vw, 28px)",
                    fontWeight: 600,
                    letterSpacing: "-0.022em",
                    lineHeight: 1.15,
                    color: "#161616",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed"
                  style={{ color: "#525252" }}
                >
                  {item.why}
                </p>
                {item.note ? (
                  <p
                    className="mt-2 max-w-[62ch] text-[14px] leading-relaxed"
                    style={{ color: "#161616" }}
                  >
                    {item.note}
                  </p>
                ) : null}

                {item.evidence ? (
                  <details className="spn-det mt-5" open={item.defaultOpen}>
                    <summary
                      className="inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.12em]"
                      style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
                    >
                      <ChevronDown className="spn-chev h-3.5 w-3.5" aria-hidden />
                      {item.evidenceLabel ?? "See the evidence"}
                    </summary>
                    <div className="spn-body">{item.evidence}</div>
                  </details>
                ) : null}

                <div
                  className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4"
                  style={{ borderColor: "#f4f4f4" }}
                >
                  <span className="text-[13.5px] font-medium" style={{ color: "#161616" }}>
                    LeaseStack fixes this.
                  </span>
                  <BookDemoLink
                    className="spn-cta inline-flex items-center gap-1 text-[13.5px] font-semibold"
                    style={{ color: "#0f62fe" }}
                    ariaLabel={`Book a 15-minute call about: ${item.title}`}
                  >
                    Book 15 min <span className="spn-arr" aria-hidden>→</span>
                  </BookDemoLink>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const COUNT_WORDS: Record<number, string> = { 2: "Two", 3: "Three" };
