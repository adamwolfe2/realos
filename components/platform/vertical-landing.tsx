import Link from "next/link";

// Claude-style vertical landing: parchment canvas, warm cards, serif
// display headlines, terracotta accent for CTAs and eyebrow highlights.
// No photos. Editorial section cadence: hero -> pains -> modules -> dark
// platform moment -> CTA.

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
  ctaHref = "/onboarding",
}: VerticalLandingProps) {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <section style={{ borderBottom: "1px solid #f0eee6" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-16 md:pb-20 text-center">
          <p className="eyebrow mb-6" style={{ color: "#2F6FE5" }}>
            {eyebrow}
          </p>
          <h1
            className="mx-auto max-w-[880px]"
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
            }}
          >
            {headline}
          </h1>
          <p
            className="mx-auto mt-6 max-w-[620px]"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
            }}
          >
            {subhead}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={ctaHref} className="btn-primary">
              Book a demo
            </Link>
            <Link
              href="https://www.telegraphcommons.com"
              className="btn-secondary"
              target="_blank"
              rel="noopener"
            >
              See it live
            </Link>
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#faf9f5" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="text-center mb-14">
            <p className="eyebrow mb-4">Operators tell us</p>
            <h2
              className="mx-auto max-w-[720px]"
              style={{
                color: "#141413",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 3.4vw, 40px)",
                fontWeight: 500,
                lineHeight: 1.15,
              }}
            >
              The three things that made them look.
            </h2>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pains.map((p, i) => (
              <li
                key={p.title}
                className="p-7"
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  boxShadow: "0 0 0 1px #f0eee6",
                }}
              >
                <span
                  style={{
                    color: "#2F6FE5",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.14em",
                    fontWeight: 500,
                  }}
                >
                  0{i + 1}
                </span>
                <h3
                  className="mt-4"
                  style={{
                    color: "#141413",
                    fontFamily: "var(--font-display)",
                    fontSize: "20px",
                    fontWeight: 500,
                    lineHeight: 1.25,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    color: "#5e5d59",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    lineHeight: 1.6,
                  }}
                >
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ backgroundColor: "#f5f4ed" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="text-center mb-14">
            <p className="eyebrow mb-4">What you get on day one</p>
            <h2
              className="mx-auto max-w-[720px]"
              style={{
                color: "#141413",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 3.4vw, 40px)",
                fontWeight: 500,
                lineHeight: 1.15,
              }}
            >
              Six modules. One launch. Live in two weeks.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((m) => (
              <div
                key={m.title}
                className="p-7"
                style={{
                  backgroundColor: "#faf9f5",
                  borderRadius: "16px",
                  boxShadow: "0 0 0 1px #f0eee6",
                }}
              >
                <h3
                  style={{
                    color: "#141413",
                    fontFamily: "var(--font-display)",
                    fontSize: "20px",
                    fontWeight: 500,
                    lineHeight: 1.25,
                  }}
                >
                  {m.title}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    color: "#5e5d59",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    lineHeight: 1.6,
                  }}
                >
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#141413" }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
          <p
            style={{
              color: "#87867f",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: "16px",
            }}
          >
            One platform
          </p>
          <h2
            className="mx-auto max-w-[760px]"
            style={{
              color: "#faf9f5",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(30px, 3.8vw, 44px)",
              fontWeight: 500,
              lineHeight: 1.15,
            }}
          >
            The same modules every operator gets. The playbook is what changes.
          </h2>
          <p
            className="mx-auto mt-5 max-w-[620px]"
            style={{
              color: "#b0aea5",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            Same site engine, same pixel, same chatbot, same ad-managed studio.
            Different intake playbook, different creative library, different
            compliance guardrails per vertical.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={ctaHref} className="btn-primary">
              Book a demo
            </Link>
            <Link
              href="https://www.telegraphcommons.com"
              className="btn-secondary-dark"
              target="_blank"
              rel="noopener"
            >
              See it live
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
