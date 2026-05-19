// ---------------------------------------------------------------------------
// Solution — three pillars. One sentence each. The point is clarity, not
// completeness; the modules grid below does the detail work.
// ---------------------------------------------------------------------------

const PILLARS: Array<{ title: string; copy: string }> = [
  {
    title: "Unified marketing stack",
    copy: "Site, chatbot, lead capture, ads, and reputation are one product. One login. One inbox. No duct tape.",
  },
  {
    title: "Real-time attribution",
    copy: "Every visit, lead, tour, and lease is tied back to the channel and creative that produced it. Your spend has a name.",
  },
  {
    title: "Done-for-you ops",
    copy: "We launch your site, run your ads, and ghost-write your weekly read. Or you self-serve. Either way, no learning curve.",
  },
];

export function LandingSolution() {
  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1080px] mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="max-w-2xl mb-16 md:mb-20">
          <p className="eyebrow mb-4">The platform</p>
          <h2
            style={{
              color: "#0B1220",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(32px, 4.5vw, 48px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.022em",
            }}
          >
            One platform.
            <br />
            <span style={{ color: "#2563EB" }}>Three pillars.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px"
          style={{ backgroundColor: "#EEF2F6", border: "1px solid #EEF2F6" }}
        >
          {PILLARS.map((p) => (
            <div
              key={p.title}
              style={{
                backgroundColor: "#FFFFFF",
                padding: "40px 32px",
              }}
            >
              <h3
                style={{
                  color: "#0B1220",
                  fontFamily: "var(--font-sans)",
                  fontSize: "20px",
                  fontWeight: 600,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.25,
                }}
              >
                {p.title}
              </h3>
              <p
                className="mt-3"
                style={{
                  color: "#475569",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15.5px",
                  lineHeight: 1.6,
                }}
              >
                {p.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
