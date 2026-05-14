import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// Weekly — editorial rewrite (drastic structural change).
//
// Was: 4 generic icon-card grid that read like a feature catalog.
// Now: a single-column day-by-day narrative. Each beat is a clean horizontal
// row — DAY + TIME on the left rail, then the headline and body in the
// editorial column. Reads as an operator's actual week, not a feature grid.
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
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-16">
          <p className="eyebrow mb-4">{weekly.eyebrow}</p>
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(34px, 4.8vw, 56px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            {weekly.headline}
          </h2>
          <p
            className="mt-6 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {weekly.body}
          </p>
        </div>

        {/* Day-by-day editorial flow. No cards, no icons, just typographic
            rhythm anchored to a left rail. */}
        <ol
          style={{
            borderTop: "1px solid #E2E8F0",
          }}
        >
          {weekly.items.map((item) => (
            <li
              key={item.title}
              className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 md:gap-12 py-10 md:py-12"
              style={{ borderBottom: "1px solid #E2E8F0" }}
            >
              {/* Left rail — day + time, mono, restrained. */}
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

              {/* Right column — title + body */}
              <div>
                <h3
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(22px, 2.4vw, 30px)",
                    fontWeight: 700,
                    lineHeight: 1.18,
                    letterSpacing: "-0.02em",
                    maxWidth: "720px",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-4 max-w-[680px]"
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-sans)",
                    fontSize: "16.5px",
                    lineHeight: 1.6,
                  }}
                >
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
