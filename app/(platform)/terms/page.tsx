import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms of use for ${BRAND_NAME}.`,
};

export const revalidate = 86400;

const SECTIONS = [
  {
    title: "Using the platform",
    body: [
      `${BRAND_NAME} is a managed marketing platform for real estate operators. Access is restricted to clients who have signed a written engagement.`,
      "By using the platform you agree to these terms. If you do not agree, do not use the platform.",
    ],
  },
  {
    title: "Account responsibilities",
    body: [
      "You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorized use.",
      "You may not share access credentials outside your organization, except with agency team members we explicitly invite.",
    ],
  },
  {
    title: "Billing and cancellation",
    body: [
      "Monthly retainers are billed in advance. Build fees are billed on contract signing.",
      "Month-to-month retainer agreements can be cancelled with 30 days written notice after your site launches.",
      "Ad spend is billed separately through your own ad platform accounts. We charge a management fee as described in your proposal.",
    ],
  },
  {
    title: "Intellectual property",
    body: [
      `All platform source code, design, and copy is owned by ${BRAND_NAME}. We grant you a non-exclusive license to use the outputs for your properties during the term.`,
      "Property-specific content (logos, photos, descriptions) you provide remains yours. You grant us the license to display it on your marketing surfaces.",
    ],
  },
  {
    title: "Limitation of liability",
    body: [
      "We work hard to keep your marketing stack online. The platform is provided as is without warranties of any kind.",
      "Our liability is limited to the total fees you have paid us in the 12 months preceding the claim.",
    ],
  },
  {
    title: "Contact",
    body: [`${BRAND_NAME}, San Diego, California.`, "hello@realestaite.co"],
  },
];

export default function TermsPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Legal
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            Terms of use
          </h1>
          <p
            className="mt-5 font-mono text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Last updated: April 17, 2026
          </p>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2
              className="font-serif text-2xl font-normal"
              style={{ color: "var(--text-headline)" }}
            >
              {s.title}
            </h2>
            <div
              className="mt-4 space-y-3 font-mono text-sm leading-relaxed"
              style={{ color: "var(--text-body)" }}
            >
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
