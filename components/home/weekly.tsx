import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// Weekly — operating rhythm.
//
// Was a three-column layout (day rail | copy | tiny faux-UI artifact card)
// where the right-rail "product surface" cards read as visual noise at
// 260×132. Stripped back to a clean editorial two-column list: when on
// the left, what + body + concrete outcome on the right. No fake
// mockups. Each row earns its space with a real proof point.
// ---------------------------------------------------------------------------

export function Weekly() {
  const { weekly } = MARKETING.home;

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-3xl mb-12 md:mb-16">
          <p className="eyebrow mb-3">{weekly.eyebrow}</p>
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
            {weekly.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.55,
            }}
          >
            {weekly.body}
          </p>
        </div>

        {/* Editorial list. Two columns: when (left, narrow) and what +
            body + outcome (right, wide). Hairline between rows. */}
        <ol style={{ borderTop: "1px solid #E2E8F0" }}>
          {weekly.items.map((item) => (
            <li
              key={item.title}
              className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-3 md:gap-12 py-8 md:py-10"
              style={{ borderBottom: "1px solid #E2E8F0" }}
            >
              {/* When */}
              <div>
                <p
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {item.day}
                </p>
                <p
                  className="mt-1"
                  style={{
                    color: "#94A3B8",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  {item.time}
                </p>
              </div>

              {/* What + body + outcome */}
              <div>
                <h3
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(19px, 1.9vw, 22px)",
                    fontWeight: 700,
                    lineHeight: 1.22,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-3 max-w-[640px]"
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    lineHeight: 1.6,
                  }}
                >
                  {item.body}
                </p>
                {item.outcome && (
                  <p
                    className="mt-4 inline-flex items-center gap-2"
                    style={{
                      color: "#2563EB",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11.5px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 1,
                        backgroundColor: "#2563EB",
                      }}
                    />
                    {item.outcome}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
