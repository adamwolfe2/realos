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
  return (
    <section style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 lg:gap-16 items-start">
          {/* Left rail — header, sticky on desktop so it stays with the
              questions as you scroll. */}
          <div className="lg:sticky lg:top-24">
            <p className="eyebrow mb-3">{faq.eyebrow}</p>
            <h2
              style={{
                color: "#1E2A3A",
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
              className="mt-4 max-w-md"
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                lineHeight: 1.55,
              }}
            >
              Direct answers to the questions operators ask before they sign.
              Anything we missed?{" "}
              <a
                href="mailto:hello@leasestack.co"
                style={{
                  color: "#2563EB",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
              >
                hello@leasestack.co
              </a>
              .
            </p>
          </div>

          {/* Right column — questions in a clean bordered card so the
              section reads as a defined block, not floating text. */}
          <ul
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {faq.items.map((item, i) => (
              <li
                key={item.q}
                style={{
                  borderTop: i === 0 ? "none" : "1px solid #E2E8F0",
                }}
              >
                <details className="group">
                  <summary
                    className="flex items-center justify-between gap-6 px-5 py-4 cursor-pointer list-none hover:bg-[#F8FAFC] transition-colors"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15.5px",
                      fontWeight: 600,
                      color: "#1E2A3A",
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
                        color: "#94A3B8",
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
                      color: "#64748B",
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
      </div>
    </section>
  );
}
