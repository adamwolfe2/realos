import { MARKETING } from "@/lib/copy/marketing";

export function Faq() {
  const { faq } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-12 md:mb-14">
          <p className="eyebrow mb-4">{faq.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#1E2A3A" }}>
            {faq.headline}
          </h2>
        </div>

        <ul
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 0 0 1px #E2E8F0",
            overflow: "hidden",
          }}
        >
          {faq.items.map((item, i) => (
            <li
              key={item.q}
              style={{
                borderTop: i > 0 ? "1px solid #E2E8F0" : "none",
              }}
            >
              <details className="group">
                <summary
                  className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "17px",
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
                      width: "24px",
                      height: "24px",
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
                  className="px-6 pb-5 -mt-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    lineHeight: 1.65,
                    color: "#64748B",
                    maxWidth: "680px",
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
