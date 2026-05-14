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
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-12 lg:gap-20 items-start">
          {/* Left rail — header, sticky on desktop so it stays with the
              questions as you scroll. */}
          <div className="lg:sticky lg:top-24">
            <p className="eyebrow mb-4">{faq.eyebrow}</p>
            <h2
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(34px, 4.4vw, 52px)",
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.025em",
              }}
            >
              {faq.headline}
            </h2>
            <p
              className="mt-6 max-w-md"
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                lineHeight: 1.6,
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

          {/* Right column — questions, hairline-separated, no card chrome. */}
          <ul style={{ borderTop: "1px solid #E2E8F0" }}>
            {faq.items.map((item) => (
              <li
                key={item.q}
                style={{ borderBottom: "1px solid #E2E8F0" }}
              >
                <details className="group">
                  <summary
                    className="flex items-center justify-between gap-6 py-6 cursor-pointer list-none"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1E2A3A",
                      lineHeight: 1.35,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <span>{item.q}</span>
                    <span
                      aria-hidden="true"
                      className="flex-shrink-0 inline-flex items-center justify-center transition-transform group-open:rotate-45"
                      style={{
                        width: "20px",
                        height: "20px",
                        color: "#94A3B8",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
                    className="pb-6 -mt-1"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15.5px",
                      lineHeight: 1.65,
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
