import Link from "next/link";

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
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--blue)" }}
          >
            {eyebrow}
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            {headline}
          </h1>
          <p
            className="mt-5 font-mono text-sm md:text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--text-body)" }}
          >
            {subhead}
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 space-y-14">
          <Block label="What it is" body={whatItIs} />

          <div>
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              How it works
            </p>
            <ol className="space-y-3">
              {howItWorks.map((step, i) => (
                <li
                  key={step}
                  className="p-5 bg-white flex gap-4"
                  style={{
                    border: "1px solid var(--border-strong)",
                    borderRadius: "10px",
                  }}
                >
                  <span
                    className="font-mono text-sm font-semibold flex-shrink-0"
                    style={{
                      color: "var(--blue)",
                      minWidth: "2ch",
                    }}
                  >
                    0{i + 1}
                  </span>
                  <p
                    className="font-mono text-sm leading-relaxed"
                    style={{ color: "var(--text-body)" }}
                  >
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              What to expect
            </p>
            <ul className="space-y-2">
              {results.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-3 font-mono text-sm leading-relaxed"
                  style={{ color: "var(--text-body)" }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-[10px] flex-shrink-0"
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      backgroundColor: "var(--blue)",
                    }}
                  />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <Block label="Best for" body={bestFor} />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/onboarding"
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
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p
        className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p
        className="font-serif text-xl md:text-2xl font-normal leading-relaxed"
        style={{ color: "var(--text-headline)" }}
      >
        {body}
      </p>
    </div>
  );
}
