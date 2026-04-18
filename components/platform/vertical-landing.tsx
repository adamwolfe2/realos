import Link from "next/link";
import Image from "next/image";

// Tesla-style vertical landing: full-bleed cinematic hero per vertical,
// then three centered content blocks (pains, modules, case study) on white
// and light-ash canvases. No glow, no translucent cards, no gradients on UI.

export type VerticalLandingProps = {
  eyebrow: string;
  headline: string;
  subhead: string;
  pains: Array<{ title: string; body: string }>;
  modules: Array<{ title: string; body: string }>;
  caseStudy?: { client: string; stat: string; body: string };
  ctaHref?: string;
  heroImage?: string;
};

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=2400&q=85";

export function VerticalLanding({
  eyebrow,
  headline,
  subhead,
  pains,
  modules,
  caseStudy,
  ctaHref = "/onboarding",
  heroImage = DEFAULT_HERO,
}: VerticalLandingProps) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#393C41" }}>
      {/* HERO */}
      <section
        className="relative"
        style={{ height: "min(72vh, 680px)", minHeight: "520px", marginTop: "-56px" }}
      >
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(23,26,32,0.4) 0%, rgba(23,26,32,0.15) 50%, rgba(23,26,32,0.55) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="relative h-full flex flex-col">
          <div className="flex-1 flex items-center">
            <div className="w-full max-w-[1100px] mx-auto px-4 md:px-8 text-center pt-16">
              <p
                className="mb-4"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                {eyebrow}
              </p>
              <h1
                className="mx-auto max-w-[920px]"
                style={{
                  color: "#FFFFFF",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(32px, 5vw, 52px)",
                  fontWeight: 500,
                  lineHeight: 1.12,
                }}
              >
                {headline}
              </h1>
              <p
                className="mx-auto mt-5 max-w-[560px]"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 400,
                  lineHeight: 1.55,
                }}
              >
                {subhead}
              </p>
            </div>
          </div>
          <div className="pb-16">
            <div className="max-w-[1100px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={ctaHref} className="btn-primary">
                Book a demo
              </Link>
              <Link href="/pricing" className="btn-secondary-dark">
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PAINS */}
      <section style={{ backgroundColor: "#F4F4F4" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="text-center mb-12">
            <p
              style={{
                color: "#5C5E62",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 500,
                marginBottom: "12px",
              }}
            >
              Operators tell us
            </p>
            <h2 className="heading-section mx-auto max-w-[680px]" style={{ color: "#171A20" }}>
              The three things that made them look.
            </h2>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pains.map((p, i) => (
              <li
                key={p.title}
                className="p-6"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                }}
              >
                <span
                  style={{
                    color: "#8E8E8E",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    fontWeight: 500,
                  }}
                >
                  0{i + 1}
                </span>
                <h3
                  className="mt-3"
                  style={{
                    color: "#171A20",
                    fontFamily: "var(--font-display)",
                    fontSize: "18px",
                    fontWeight: 500,
                    lineHeight: 1.25,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    color: "#393C41",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    fontWeight: 400,
                    lineHeight: 1.5,
                  }}
                >
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* MODULES */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="text-center mb-12">
            <p
              style={{
                color: "#5C5E62",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 500,
                marginBottom: "12px",
              }}
            >
              What you get on day one
            </p>
            <h2 className="heading-section mx-auto max-w-[680px]" style={{ color: "#171A20" }}>
              Six modules. One launch. Ship in two weeks.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modules.map((m) => (
              <div
                key={m.title}
                className="p-6"
                style={{
                  backgroundColor: "#F4F4F4",
                  borderRadius: "12px",
                }}
              >
                <h3
                  style={{
                    color: "#171A20",
                    fontFamily: "var(--font-display)",
                    fontSize: "18px",
                    fontWeight: 500,
                    lineHeight: 1.25,
                  }}
                >
                  {m.title}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    color: "#393C41",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    fontWeight: 400,
                    lineHeight: 1.5,
                  }}
                >
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDY */}
      {caseStudy ? (
        <section style={{ backgroundColor: "#171A20" }}>
          <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 500,
                marginBottom: "12px",
              }}
            >
              Case study
            </p>
            <h3
              className="mx-auto max-w-[760px]"
              style={{
                color: "#FFFFFF",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 3.6vw, 40px)",
                fontWeight: 500,
                lineHeight: 1.15,
              }}
            >
              {caseStudy.client}
            </h3>
            <p
              className="mx-auto mt-5 max-w-[620px]"
              style={{
                color: "rgba(255,255,255,0.8)",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 400,
                lineHeight: 1.6,
              }}
            >
              {caseStudy.body}
            </p>
            <p
              className="mt-12 leading-none"
              style={{
                color: "#FFFFFF",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(56px, 8vw, 88px)",
                fontWeight: 500,
              }}
            >
              {caseStudy.stat}
            </p>
            <p
              className="mt-3"
              style={{
                color: "rgba(255,255,255,0.65)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Result in 30 days
            </p>
          </div>
        </section>
      ) : null}

      {/* FINAL CTA */}
      <section style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <h2 className="heading-section mx-auto max-w-[680px]" style={{ color: "#171A20" }}>
            See the platform in your stack.
          </h2>
          <p
            className="mx-auto mt-4 max-w-[520px]"
            style={{
              color: "#393C41",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.55,
            }}
          >
            Thirty minutes. No obligation. We audit your current marketing live
            on the call.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={ctaHref} className="btn-primary">
              Book a demo
            </Link>
            <Link href="/pricing" className="btn-secondary">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
