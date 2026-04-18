import Link from "next/link";

export type VerticalLandingProps = {
  eyebrow: string;
  headline: string;
  subhead: string;
  pains: Array<{ title: string; body: string }>;
  modules: Array<{ title: string; body: string }>;
  caseStudy?: { client: string; stat: string; body: string };
  ctaHref?: string;
};

export function VerticalLanding({
  eyebrow,
  headline,
  subhead,
  pains,
  modules,
  caseStudy,
  ctaHref = "/onboarding",
}: VerticalLandingProps) {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <section
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-24 pb-16 md:pb-20">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            {eyebrow}
          </p>
          <h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] max-w-4xl"
            style={{ color: "var(--text-headline)" }}
          >
            {headline}
          </h1>
          <p
            className="mt-6 font-mono text-sm md:text-base leading-relaxed max-w-3xl"
            style={{ color: "var(--text-body)" }}
          >
            {subhead}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={ctaHref}
              className="font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                backgroundColor: "var(--blue)",
                color: "white",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                border: "1px solid var(--border-strong)",
                color: "var(--text-headline)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "var(--bg-blue-dark)", color: "white" }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
            style={{ opacity: 0.6 }}
          >
            Operators tell us
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-normal max-w-3xl">
            The three things that made them look.
          </h2>
          <ul className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            {pains.map((p, i) => (
              <li
                key={p.title}
                className="p-6"
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  className="font-mono text-[10px]"
                  style={{ opacity: 0.5 }}
                >
                  0{i + 1}
                </span>
                <h3 className="font-serif text-lg md:text-xl font-normal mt-3 leading-snug">
                  {p.title}
                </h3>
                <p
                  className="font-mono text-xs mt-4 leading-relaxed"
                  style={{ opacity: 0.8 }}
                >
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            What you get on day one
          </p>
          <h2
            className="font-serif text-3xl md:text-4xl font-normal max-w-3xl"
            style={{ color: "var(--text-headline)" }}
          >
            Six modules. One launch. Ship in two weeks.
          </h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((m) => (
              <div
                key={m.title}
                className="p-6 bg-white"
                style={{
                  border: "1px solid var(--border-strong)",
                  borderRadius: "10px",
                }}
              >
                <h3
                  className="font-serif text-lg font-semibold"
                  style={{ color: "var(--text-headline)" }}
                >
                  {m.title}
                </h3>
                <p
                  className="font-mono text-xs mt-3 leading-relaxed"
                  style={{ color: "var(--text-body)" }}
                >
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {caseStudy ? (
        <section
          style={{
            backgroundColor: "var(--blue-light)",
            borderTop: "1px solid var(--blue-border)",
            borderBottom: "1px solid var(--blue-border)",
          }}
        >
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <p
                className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
                style={{ color: "var(--blue)" }}
              >
                Case study
              </p>
              <p
                className="font-serif text-3xl md:text-4xl font-normal"
                style={{ color: "var(--text-headline)" }}
              >
                {caseStudy.client}
              </p>
              <p
                className="font-mono text-sm leading-relaxed mt-5 max-w-lg"
                style={{ color: "var(--text-body)" }}
              >
                {caseStudy.body}
              </p>
            </div>
            <div
              className="p-10 bg-white text-center"
              style={{
                border: "1px solid var(--border-strong)",
                borderRadius: "14px",
              }}
            >
              <p
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--text-muted)" }}
              >
                Result in 30 days
              </p>
              <p
                className="font-serif font-normal mt-4"
                style={{
                  fontSize: "72px",
                  lineHeight: 1,
                  color: "var(--bg-blue-dark)",
                }}
              >
                {caseStudy.stat}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-16">
          <div
            className="p-10 md:p-14 text-center"
            style={{
              backgroundColor: "var(--bg-blue-dark)",
              borderRadius: "16px",
              color: "white",
            }}
          >
            <h2 className="font-serif text-3xl md:text-4xl font-normal">
              See the platform in your stack.
            </h2>
            <p
              className="font-mono text-sm leading-relaxed mt-4 max-w-xl mx-auto"
              style={{ opacity: 0.85 }}
            >
              Thirty minutes. No obligation. We audit your current marketing
              live on the call.
            </p>
            <Link
              href={ctaHref}
              className="mt-8 inline-block font-mono text-xs font-semibold px-6 py-4 rounded"
              style={{
                backgroundColor: "white",
                color: "var(--bg-blue-dark)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Book a demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
