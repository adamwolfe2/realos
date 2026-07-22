import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// FAQ — editorial rewrite (matches new home rhythm).
//
// Was: bordered card-wrapped list with details/summary in a single tile.
// Now: split editorial layout — header on the left rail, FAQ items on the
// right, hairline-separated, no card chrome. Reads as documentation, not
// a UI widget.
// ---------------------------------------------------------------------------

export function Faq() {
  const { faq } = MARKETING.home;
  // Norman v2 (2026-06-01): Was split editorial — header sticky on the
  // left, questions on the right. Adam asked to stack both vertically,
  // centered, so the section reads as one focused block instead of a
  // two-column scan. Header + intro centered above, questions list
  // capped at max-w-3xl and centered below.
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[800px] mx-auto px-4 md:px-8 py-20 md:py-24">
        {/* Centered header block */}
        <div className="text-center mb-10 md:mb-12">
          <p className="eyebrow mb-3">{faq.eyebrow}</p>
          <h2
            style={{
              color: "#161616",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            {faq.headline}
          </h2>
          <p
            className="mt-4 mx-auto max-w-md"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.55,
            }}
          >
            Direct answers to the questions operators ask before they sign.
            Anything we missed?{" "}
            <a
              href="mailto:team@leasestack.co"
              style={{
                color: "#0f62fe",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              team@leasestack.co
            </a>
            .
          </p>
        </div>

        {/* Questions — clean bordered card, full width of the centered
            column so the section reads as a defined block. */}
        <ul
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #e0e0e0",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
            {faq.items.map((item, i) => (
              <li
                key={item.q}
                style={{
                  borderTop: i === 0 ? "none" : "1px solid #e0e0e0",
                }}
              >
                <details className="group">
                  <summary
                    className="flex items-center justify-between gap-6 px-5 py-4 cursor-pointer list-none hover:bg-[#f4f4f4] transition-colors"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15.5px",
                      fontWeight: 600,
                      color: "#161616",
                      lineHeight: 1.35,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    <span>{item.q}</span>
                    <span
                      aria-hidden="true"
                      className="flex-shrink-0 inline-flex items-center justify-center transition-transform group-open:rotate-45"
                      style={{
                        width: "18px",
                        height: "18px",
                        color: "#8d8d8d",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M7 2v10M2 7h10"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </summary>
                  <div
                    className="px-5 pb-5 -mt-1"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      color: "#6f6f6f",
                      maxWidth: "640px",
                    }}
                  >
                    {item.a}
                  </div>
                </details>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}
