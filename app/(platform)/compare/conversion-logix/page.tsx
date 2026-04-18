import type { Metadata } from "next";
import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME} vs Conversion Logix`,
  description: MARKETING.compareCLX.subhead,
};

export default function CompareCLX() {
  const { compareCLX } = MARKETING;
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-14 text-center">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            {compareCLX.eyebrow}
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            {compareCLX.heading}
          </h1>
          <p
            className="mt-5 font-mono text-sm md:text-base leading-relaxed max-w-2xl mx-auto"
            style={{ color: "var(--text-body)" }}
          >
            {compareCLX.subhead}
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16">
          <div
            className="overflow-hidden bg-white"
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "12px",
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{
                    borderBottom: "1px solid var(--border-strong)",
                    color: "var(--text-muted)",
                  }}
                >
                  <th className="text-left px-5 py-4 font-normal">Feature</th>
                  <th className="text-left px-5 py-4 font-normal">
                    Conversion Logix
                  </th>
                  <th
                    className="text-left px-5 py-4 font-normal"
                    style={{
                      backgroundColor: "var(--bg-blue-dark)",
                      color: "white",
                    }}
                  >
                    {BRAND_NAME}
                  </th>
                </tr>
              </thead>
              <tbody>
                {compareCLX.rows.map((r, i) => (
                  <tr
                    key={r.feature}
                    style={{
                      borderBottom:
                        i < compareCLX.rows.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  >
                    <td
                      className="px-5 py-4 font-serif text-base"
                      style={{ color: "var(--text-headline)" }}
                    >
                      {r.feature}
                    </td>
                    <td
                      className="px-5 py-4 font-mono text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {r.clx}
                    </td>
                    <td
                      className="px-5 py-4 font-mono text-xs font-semibold"
                      style={{
                        backgroundColor: "var(--blue-light)",
                        color: "var(--text-headline)",
                      }}
                    >
                      {r.ours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
          <p
            className="font-mono text-xs leading-relaxed"
            style={{ color: "var(--text-body)" }}
          >
            {compareCLX.footerCopy}
          </p>
        </div>
      </section>

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
              Bring the invoice.
            </h2>
            <p
              className="font-mono text-sm leading-relaxed mt-4 max-w-xl mx-auto"
              style={{ opacity: 0.85 }}
            >
              We audit your current marketing stack live on the call. Most
              clients find the switch saves money in month one.
            </p>
            <Link
              href="/onboarding"
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
