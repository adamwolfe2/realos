import Link from "next/link";

// Linear-inspired vertical landing shell. Dark canvas throughout, with the
// middle "pains" block on a slightly recessed panel for rhythm. All cards
// are translucent-white on dark (never white-on-white).

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
    <div
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}
    >
      <section
        className="relative overflow-hidden hero-glow"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="absolute inset-0 grid-fade pointer-events-none" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-24 pb-20 md:pb-24 relative">
          <p
            className="font-mono text-[11px] mb-5"
            style={{
              color: "var(--accent-bright)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 510,
            }}
          >
            {eyebrow}
          </p>
          <h1
            className="max-w-4xl"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(40px, 5.6vw, 64px)",
              fontWeight: 510,
              letterSpacing: "-0.028em",
              lineHeight: 1.03,
            }}
          >
            {headline}
          </h1>
          <p
            className="mt-6 text-[16px] leading-relaxed max-w-3xl"
            style={{ color: "var(--text-muted)", letterSpacing: "-0.011em" }}
          >
            {subhead}
          </p>
          <div className="mt-10 flex flex-wrap gap-2.5">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-accent text-[14px]"
              style={{ fontWeight: 510 }}
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-ghost text-[14px]"
              style={{ fontWeight: 510 }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section
        style={{
          backgroundColor: "var(--bg-panel)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <p className="eyebrow mb-4">Operators tell us</p>
          <h2
            className="max-w-3xl"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 510,
              letterSpacing: "-0.022em",
              lineHeight: 1.08,
            }}
          >
            The three things that made them look.
          </h2>
          <ul className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {pains.map((p, i) => (
              <li
                key={p.title}
                className="p-6 rounded-xl"
                style={{
                  border: "1px solid var(--border-standard)",
                  backgroundColor: "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  className="font-mono text-[10px]"
                  style={{
                    color: "var(--text-subtle)",
                    letterSpacing: "0.14em",
                    fontWeight: 510,
                  }}
                >
                  0{i + 1}
                </span>
                <h3
                  className="mt-3 leading-snug"
                  style={{
                    color: "var(--text-headline)",
                    fontSize: "18px",
                    fontWeight: 510,
                    letterSpacing: "-0.012em",
                  }}
                >
                  {p.title}
                </h3>
                <p
                  className="text-[13px] mt-4 leading-relaxed"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "-0.011em",
                  }}
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
          <p className="eyebrow mb-4">What you get on day one</p>
          <h2
            className="max-w-3xl"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 510,
              letterSpacing: "-0.022em",
              lineHeight: 1.08,
            }}
          >
            Six modules. One launch. Ship in two weeks.
          </h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((m) => (
              <div
                key={m.title}
                className="p-6 rounded-xl"
                style={{
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-standard)",
                }}
              >
                <h3
                  style={{
                    color: "var(--text-headline)",
                    fontSize: "18px",
                    fontWeight: 590,
                    letterSpacing: "-0.012em",
                  }}
                >
                  {m.title}
                </h3>
                <p
                  className="text-[13px] mt-3 leading-relaxed"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "-0.011em",
                  }}
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
          className="relative overflow-hidden"
          style={{
            backgroundColor: "var(--bg-panel)",
            borderTop: "1px solid var(--border-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse at 70% 50%, rgba(94,106,210,0.14) 0%, transparent 55%)",
            }}
          />
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center relative">
            <div>
              <p className="eyebrow">Case study</p>
              <p
                className="mt-4"
                style={{
                  color: "var(--text-headline)",
                  fontSize: "clamp(28px, 3.6vw, 40px)",
                  fontWeight: 510,
                  letterSpacing: "-0.022em",
                  lineHeight: 1.08,
                }}
              >
                {caseStudy.client}
              </p>
              <p
                className="text-[14px] leading-relaxed mt-5 max-w-lg"
                style={{
                  color: "var(--text-muted)",
                  letterSpacing: "-0.011em",
                }}
              >
                {caseStudy.body}
              </p>
            </div>
            <div
              className="p-10 text-center rounded-2xl relative overflow-hidden"
              style={{
                border: "1px solid var(--border-standard)",
                backgroundColor: "rgba(255,255,255,0.02)",
                boxShadow:
                  "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset",
              }}
            >
              <span
                className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none"
                aria-hidden="true"
                style={{
                  background:
                    "radial-gradient(circle at center, var(--accent-glow) 0%, transparent 70%)",
                }}
              />
              <p className="eyebrow relative">Result in 30 days</p>
              <p
                className="mt-4 leading-none relative"
                style={{
                  color: "var(--accent-bright)",
                  fontSize: "clamp(56px, 8vw, 88px)",
                  fontWeight: 510,
                  letterSpacing: "-0.03em",
                }}
              >
                {caseStudy.stat}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <div
            className="p-10 md:p-14 text-center relative overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-standard)",
              boxShadow:
                "0 20px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
            }}
          >
            <span
              className="absolute -top-40 -left-40 w-80 h-80 rounded-full pointer-events-none"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at center, var(--accent-glow) 0%, transparent 70%)",
              }}
            />
            <h2
              className="relative"
              style={{
                color: "var(--text-headline)",
                fontSize: "clamp(28px, 3.6vw, 40px)",
                fontWeight: 510,
                letterSpacing: "-0.022em",
                lineHeight: 1.1,
              }}
            >
              See the platform in your stack.
            </h2>
            <p
              className="text-[15px] leading-relaxed mt-4 max-w-xl mx-auto relative"
              style={{
                color: "var(--text-muted)",
                letterSpacing: "-0.011em",
              }}
            >
              Thirty minutes. No obligation. We audit your current marketing
              live on the call.
            </p>
            <div className="mt-8 flex justify-center gap-2.5 relative">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-accent text-[14px]"
                style={{ fontWeight: 510 }}
              >
                Book a demo
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md btn-ghost text-[14px]"
                style={{ fontWeight: 510 }}
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
