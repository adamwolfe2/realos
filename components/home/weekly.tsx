import { MARKETING } from "@/lib/copy/marketing";

// ---------------------------------------------------------------------------
// Weekly — operating rhythm with product-flavored mini surfaces.
//
// Earlier version was a single-column text narrative with day labels on a
// left rail — read as a magazine article. This rewrite keeps the editorial
// rhythm but adds a right-rail product artifact per day so the section
// shows what each touchpoint actually looks like inside the product. Less
// vertical whitespace, more density.
// ---------------------------------------------------------------------------

// Map weekly.items by index → artifact kind. Order matches MARKETING.home.weekly.items.
const ARTIFACT_KINDS: Array<"report" | "pipeline" | "creative" | "chat"> = [
  "report",
  "pipeline",
  "creative",
  "chat",
];

export function Weekly() {
  const { weekly } = MARKETING.home;

  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-3xl mb-10 md:mb-14">
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

        {/* Day-by-day. Three columns: day rail (140px), copy (flex), artifact
            (260px). Each row is a product surface, not just a paragraph. */}
        <ol style={{ borderTop: "1px solid #E2E8F0" }}>
          {weekly.items.map((item, i) => (
            <li
              key={item.title}
              className="grid grid-cols-1 md:grid-cols-[140px_minmax(0,1fr)_260px] gap-4 md:gap-8 py-7 md:py-8 items-center"
              style={{ borderBottom: "1px solid #E2E8F0" }}
            >
              {/* Day rail */}
              <div>
                <p
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11.5px",
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
                    fontSize: "10.5px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  {item.time}
                </p>
              </div>

              {/* Copy column */}
              <div>
                <h3
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(18px, 1.8vw, 22px)",
                    fontWeight: 700,
                    lineHeight: 1.22,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-2 max-w-[560px]"
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14.5px",
                    lineHeight: 1.55,
                  }}
                >
                  {item.body}
                </p>
              </div>

              {/* Right artifact */}
              <div className="hidden md:block">
                <WeeklyArtifact kind={ARTIFACT_KINDS[i] ?? "report"} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// WeeklyArtifact — mini product surface per day.
// ---------------------------------------------------------------------------
function WeeklyArtifact({ kind }: { kind: "report" | "pipeline" | "creative" | "chat" }) {
  const wrap: React.CSSProperties = {
    border: "1px solid #E2E8F0",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    padding: 12,
    height: 132,
    overflow: "hidden",
  };

  if (kind === "report") {
    return (
      <div style={wrap}>
        <div className="flex items-center justify-between">
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.16em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Weekly report
          </p>
          <span
            style={{
              color: "#94A3B8",
              fontFamily: "var(--font-mono)",
              fontSize: "8.5px",
              letterSpacing: "0.06em",
            }}
          >
            Mon 7:02 AM
          </span>
        </div>
        <p
          className="mt-1.5"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Telegraph Commons · Wk 18
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[
            { l: "Leads", v: "142", d: "+18%" },
            { l: "Tours", v: "38", d: "+9%" },
            { l: "CPL", v: "$42", d: "−12%" },
          ].map((k) => (
            <div
              key={k.l}
              className="px-1.5 py-1.5"
              style={{
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 2,
              }}
            >
              <p
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-mono)",
                  fontSize: "7.5px",
                  letterSpacing: "0.1em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                {k.l}
              </p>
              <p
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                  lineHeight: 1,
                  marginTop: 1,
                }}
              >
                {k.v}
              </p>
              <p
                style={{
                  color: k.d.startsWith("−") ? "#16A34A" : "#16A34A",
                  fontFamily: "var(--font-mono)",
                  fontSize: "7.5px",
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                {k.d}
              </p>
            </div>
          ))}
        </div>
        <p
          className="mt-2"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "9.5px",
            lineHeight: 1.4,
            fontStyle: "italic",
          }}
        >
          → 3 actions for this week
        </p>
      </div>
    );
  }

  if (kind === "pipeline") {
    const items = [
      { name: "Maya R.", src: "Google", new: true },
      { name: "Daniel P.", src: "Chatbot" },
      { name: "Aria T.", src: "Form" },
      { name: "Jordan S.", src: "Meta" },
    ];
    return (
      <div style={wrap}>
        <div className="flex items-center justify-between mb-2">
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.16em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Lead inbox
          </p>
          <span
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-mono)",
              fontSize: "8.5px",
              fontWeight: 700,
              backgroundColor: "rgba(37,99,235,0.10)",
              padding: "1px 4px",
              borderRadius: 1,
            }}
          >
            4 NEW
          </span>
        </div>
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.name}
              className="flex items-center justify-between px-1.5 py-1"
              style={{
                backgroundColor: it.new ? "rgba(37,99,235,0.06)" : "#F8FAFC",
                borderRadius: 1,
                borderLeft: it.new ? "2px solid #2563EB" : "2px solid transparent",
              }}
            >
              <span
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "10.5px",
                  fontWeight: 600,
                }}
              >
                {it.name}
              </span>
              <span
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-mono)",
                  fontSize: "8.5px",
                  letterSpacing: "0.04em",
                }}
              >
                {it.src}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (kind === "creative") {
    return (
      <div style={wrap}>
        <p
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.16em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Creative drop
        </p>
        <p
          className="mt-1"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          3 ads · 2 emails · 1 hero
        </p>
        <div className="mt-2 flex gap-1.5">
          {[
            { type: "AD", color: "#2563EB" },
            { type: "AD", color: "#3B82F6" },
            { type: "AD", color: "#60A5FA" },
            { type: "EM", color: "#1E2A3A" },
            { type: "EM", color: "#1E2A3A" },
            { type: "WB", color: "#16A34A" },
          ].map((c, i) => (
            <div
              key={i}
              className="flex-1 flex items-center justify-center"
              style={{
                aspectRatio: "1",
                backgroundColor: c.color,
                color: "#FFFFFF",
                borderRadius: 1,
                fontFamily: "var(--font-mono)",
                fontSize: "7.5px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                opacity: 0.9,
              }}
            >
              {c.type}
            </div>
          ))}
        </div>
        <p
          className="mt-2"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.04em",
          }}
        >
          → live in 48 hours
        </p>
      </div>
    );
  }

  // chat — bubble exchange
  return (
    <div style={{ ...wrap, backgroundColor: "#F8FAFC" }}>
      <div className="flex items-center justify-between mb-2">
        <p
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.16em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          2:14 AM · Anon
        </p>
        <span
          style={{
            color: "#16A34A",
            fontFamily: "var(--font-mono)",
            fontSize: "8.5px",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          ● Online
        </span>
      </div>
      <div
        className="px-2 py-1.5 mb-1.5"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 4,
          borderTopLeftRadius: 1,
          maxWidth: "85%",
        }}
      >
        <p
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "10.5px",
            lineHeight: 1.35,
          }}
        >
          Any 2-beds for August?
        </p>
      </div>
      <div
        className="px-2 py-1.5 ml-auto"
        style={{
          backgroundColor: "#2563EB",
          borderRadius: 4,
          borderTopRightRadius: 1,
          maxWidth: "85%",
        }}
      >
        <p
          style={{
            color: "#FFFFFF",
            fontFamily: "var(--font-sans)",
            fontSize: "10.5px",
            lineHeight: 1.35,
          }}
        >
          Yes — three left. Want a tour?
        </p>
      </div>
    </div>
  );
}
