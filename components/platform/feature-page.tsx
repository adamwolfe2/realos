import Link from "next/link";
import type { ReactNode } from "react";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// Feature page = hero only (Adam 2026-07-24): eyebrow + headline + subhead,
// the animated artifact, and the CTA row. The old whatItIs/howItWorks/
// results/bestFor scroll sections were cut — the artifact IS the pitch.

export function FeaturePage({
  eyebrow,
  headline,
  subhead,
  artifact,
}: {
  eyebrow: string;
  headline: string;
  subhead: string;
  artifact?: ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <header>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-16 text-center">
          <p
            style={{
              color: "#8d8d8d",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: "20px",
            }}
          >
            {eyebrow}
          </p>
          <h1
            className="mx-auto"
            style={{
              color: "#161616",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.005em",
            }}
          >
            {headline}
          </h1>
          <p
            className="mx-auto mt-6 max-w-[640px]"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
            }}
          >
            {subhead}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary">
              Request pilot
            </Link>
            <BookDemoLink className="btn-secondary">Book a demo</BookDemoLink>
          </div>
        </div>
      </header>

      {artifact ? (
        <section style={{ backgroundColor: "#FFFFFF" }}>
          <div className="max-w-[920px] mx-auto px-4 md:px-8 pb-24">
            {artifact}
          </div>
        </section>
      ) : null}
    </div>
  );
}
