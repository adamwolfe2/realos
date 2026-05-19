// ---------------------------------------------------------------------------
// Pain — three things operators feel every week. Restrained, no emoji,
// no exclamation marks. The job is to nod, not to shout.
// ---------------------------------------------------------------------------

const PAINS: Array<{ label: string; copy: string }> = [
  {
    label: "Leasing is slow.",
    copy: "Prospects ghost after a tour. Tour-to-lease drags from days into weeks. Every dropped lead is a month of carry.",
  },
  {
    label: "Tools don't talk.",
    copy: "Your site, CRM, ads, and reputation tools all live in separate dashboards. Nothing rolls up. Nothing reconciles.",
  },
  {
    label: "Spend disappears.",
    copy: "You can name what you spent on Google last quarter. You can't name which leases came from it. ROAS is a guess.",
  },
];

export function LandingPain() {
  return (
    <section
      style={{
        backgroundColor: "#FAFAFA",
        borderTop: "1px solid #EEF2F6",
        borderBottom: "1px solid #EEF2F6",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="max-w-2xl mb-16 md:mb-20">
          <p className="eyebrow mb-4" style={{ color: "#94A3B8" }}>
            What we hear
          </p>
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
            Three problems we hear on every operator call.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {PAINS.map((p, i) => (
            <div key={p.label}>
              <div
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                0{i + 1}
              </div>
              <h3
                className="mt-3"
                style={{
                  color: "#0B1220",
                  fontFamily: "var(--font-sans)",
                  fontSize: "22px",
                  fontWeight: 600,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.25,
                }}
              >
                {p.label}
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
