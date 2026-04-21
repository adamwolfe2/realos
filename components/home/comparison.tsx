import { MARKETING } from "@/lib/copy/marketing";

export function Comparison() {
  const { comparison } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{comparison.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {comparison.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {comparison.body}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="p-7 md:p-8"
            style={{
              backgroundColor: "#faf9f5",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: "#f0eee6",
                  color: "#87867f",
                }}
                aria-hidden="true"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="5" width="4" height="4" rx="0.7" />
                  <rect x="7.5" y="5" width="4" height="4" rx="0.7" />
                  <rect x="12.5" y="5" width="3" height="4" rx="0.7" />
                  <path d="M2.5 12h13" />
                </svg>
              </span>
              <p
                className="inline-flex items-center gap-2"
                style={{
                  color: "#87867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#c2c0b6",
                  }}
                />
                {comparison.leftLabel}
              </p>
            </div>
            <ul className="space-y-0">
              {comparison.rows.map((row, i) => (
                <li
                  key={row.old}
                  className="flex items-start gap-3"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    color: "#5e5d59",
                    lineHeight: 1.55,
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderTop: i > 0 ? "1px solid #f0eee6" : "none",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "#f0eee6",
                      color: "#87867f",
                      marginTop: "2px",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 2l6 6M8 2l-6 6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span>{row.old}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="p-7 md:p-8"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(47,111,229,0.12)",
                  color: "#2F6FE5",
                }}
                aria-hidden="true"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="3" width="13" height="12" rx="1.5" />
                  <path d="M2.5 7h13" />
                  <circle cx="5" cy="5" r="0.6" fill="currentColor" stroke="none" />
                  <path d="M5 10h3M5 12.5h6" />
                </svg>
              </span>
              <p
                className="inline-flex items-center gap-2"
                style={{
                  color: "#2F6FE5",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#2F6FE5",
                  }}
                />
                {comparison.rightLabel}
              </p>
            </div>
            <ul className="space-y-0">
              {comparison.rows.map((row, i) => (
                <li
                  key={row.new}
                  className="flex items-start gap-3"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    color: "#141413",
                    lineHeight: 1.55,
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderTop: i > 0 ? "1px solid #f0eee6" : "none",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(47,111,229,0.10)",
                      color: "#2F6FE5",
                      marginTop: "2px",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M2 5.5L4.5 8L9 3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{row.new}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
