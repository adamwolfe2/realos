import Link from "next/link";

// Linear-inspired: dark canvas, Inter display weight-510, translucent
// numbered cards for "how it works", indigo accent on eyebrow and dot.

export function FeaturePage({
  eyebrow,
  headline,
  subhead,
  whatItIs,
  howItWorks,
  results,
  bestFor,
}: {
  eyebrow: string;
  headline: string;
  subhead: string;
  whatItIs: string;
  howItWorks: string[];
  results: string[];
  bestFor: string;
}) {
  return (
    <div
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}
    >
      <header
        className="relative overflow-hidden hero-glow"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="absolute inset-0 grid-fade pointer-events-none" aria-hidden="true" />
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-16 relative">
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
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(36px, 5.2vw, 60px)",
              fontWeight: 510,
              letterSpacing: "-0.028em",
              lineHeight: 1.03,
            }}
          >
            {headline}
          </h1>
          <p
            className="mt-5 text-[16px] leading-relaxed max-w-2xl"
            style={{ color: "var(--text-muted)", letterSpacing: "-0.011em" }}
          >
            {subhead}
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 space-y-14">
          <Block label="What it is" body={whatItIs} />

          <div>
            <p className="eyebrow mb-4">How it works</p>
            <ol className="space-y-2.5">
              {howItWorks.map((step, i) => (
                <li
                  key={step}
                  className="p-5 flex gap-4 rounded-xl"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-standard)",
                  }}
                >
                  <span
                    className="font-mono text-[11px] flex-shrink-0"
                    style={{
                      color: "var(--accent-bright)",
                      minWidth: "2ch",
                      fontWeight: 510,
                      letterSpacing: "0.08em",
                      paddingTop: "2px",
                    }}
                  >
                    0{i + 1}
                  </span>
                  <p
                    className="text-[14px] leading-relaxed"
                    style={{ color: "var(--text-body)", letterSpacing: "-0.011em" }}
                  >
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="eyebrow mb-4">What to expect</p>
            <ul className="space-y-2">
              {results.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-3 text-[14px] leading-relaxed"
                  style={{ color: "var(--text-body)", letterSpacing: "-0.011em" }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center flex-shrink-0 mt-0.5 w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: "rgba(94,106,210,0.18)",
                      color: "var(--accent-bright)",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M1.5 5L4 7.5L8.5 2.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <Block label="Best for" body={bestFor} />

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/onboarding"
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
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="eyebrow mb-4">{label}</p>
      <p
        className="leading-relaxed"
        style={{
          color: "var(--text-headline)",
          fontSize: "clamp(20px, 2.2vw, 26px)",
          fontWeight: 400,
          letterSpacing: "-0.015em",
          lineHeight: 1.4,
        }}
      >
        {body}
      </p>
    </div>
  );
}
