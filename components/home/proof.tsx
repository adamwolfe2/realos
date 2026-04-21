import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";

export function Proof() {
  const { proof } = MARKETING.home;
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
        <p
          className="mb-6"
          style={{
            color: "#2F6FE5",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          The platform
        </p>
        <h2
          className="mx-auto max-w-[860px]"
          style={{
            color: "#141413",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 4vw, 48px)",
            fontWeight: 500,
            lineHeight: 1.12,
            letterSpacing: "-0.008em",
          }}
        >
          {proof.heading}
        </h2>
        <p
          className="mx-auto mt-5 max-w-[620px]"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            lineHeight: 1.6,
          }}
        >
          {proof.body}
        </p>

        <div className="mt-14 flex flex-wrap items-start justify-center gap-x-16 gap-y-8">
          <BigStat value="One" label="Platform, one login" />
          <BigStat value="Two" label="Weeks from intake to live" />
          <BigStat value="Zero" label="Long-term contracts" />
        </div>

        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/onboarding" className="btn-primary">
            Book a demo
          </Link>
          <Link href="/#live" className="btn-secondary">
            See it live
          </Link>
        </div>
      </div>
    </section>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p
        style={{
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 4.8vw, 56px)",
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: "-0.008em",
        }}
      >
        {value}
      </p>
      <p
        className="mt-2 mx-auto max-w-[180px]"
        style={{
          color: "#87867f",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        }}
      >
        {label}
      </p>
    </div>
  );
}
