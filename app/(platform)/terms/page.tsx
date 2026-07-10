import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms of use for ${BRAND_NAME}.`,
};

export const revalidate = 86400;

const SECTIONS = [
  {
    title: "The service",
    body: [
      `${BRAND_NAME} is a software-as-a-service platform that tracks leasing signals for property operators. It connects to systems you already use — property management software, web analytics, search console, ad accounts, your website, and your chatbot — and reports what they show in one place.`,
      `${BRAND_NAME} does not manage your properties, operate your leasing, place or manage advertising on your behalf, or act as your agent. You remain responsible for all decisions you make based on the data the platform reports.`,
      "By using the platform you agree to these terms. If you do not agree, do not use the platform.",
    ],
  },
  {
    title: "Account responsibilities",
    body: [
      "You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorized use.",
      "You may not share access credentials outside your organization, except with team members you invite through the platform.",
      "When you connect a third-party account (for example your property management software, analytics, or ad accounts), you confirm you are authorized to grant that access.",
    ],
  },
  {
    title: "Subscriptions and billing",
    body: [
      "The platform is sold as a subscription, priced per property on your account. Subscriptions are billed in advance through Stripe, our payment processor, on the billing cycle shown at checkout.",
      "You can cancel at any time from your account settings or by written notice. Cancellation takes effect at the end of the current billing period; we do not issue refunds for partial periods unless required by law.",
      "We will give you at least 30 days written notice before any price change takes effect.",
      `${BRAND_NAME} does not bill or manage ad spend. Advertising runs in your own ad platform accounts, on their terms; the platform only reads performance data you authorize.`,
    ],
  },
  {
    title: "Your data",
    body: [
      "Data you connect or upload — property records, leasing data, analytics, lead and visitor information — remains yours. You grant us the license needed to process and display it inside the platform for your account.",
      "We process connected data only to provide the service, as described in our privacy policy. We do not sell your data.",
      "You are responsible for ensuring you have the right to connect the data sources you connect, including any notices or consents your own applicants, residents, or website visitors require.",
    ],
  },
  {
    title: "Intellectual property",
    body: [
      `All platform source code, design, and documentation is owned by ${BRAND_NAME}. We grant you a non-exclusive, non-transferable license to use the platform during your subscription.`,
      "Content you provide (logos, photos, property descriptions) remains yours.",
    ],
  },
  {
    title: "Termination",
    body: [
      "You may stop using the platform and cancel your subscription at any time. We may suspend or terminate accounts that violate these terms or fail to pay, after reasonable notice where practical.",
      "On termination, access ends at the close of the paid period. On written request within 30 days of termination, we will export or delete the data associated with your account.",
    ],
  },
  {
    title: "Limitation of liability",
    body: [
      "We work hard to keep the platform reliable, but it is provided as is, without warranties of any kind. Signal data depends on the third-party systems you connect, and we do not guarantee its completeness or accuracy.",
      "To the maximum extent permitted by law, our liability is limited to the total fees you have paid us in the 12 months preceding the claim.",
    ],
  },
  {
    title: "Contact",
    body: [`${BRAND_NAME}, San Diego, California.`, "team@leasestack.co"],
  },
];

export default function TermsPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.12em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Legal
          </p>
          <h1
            className="text-4xl md:text-5xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)", fontFamily: "var(--font-display)" }}
          >
            Terms of use
          </h1>
          <p
            className="mt-5 font-mono text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Last updated: July 10, 2026
          </p>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2
              className="text-2xl font-semibold"
              style={{ color: "var(--text-headline)", fontFamily: "var(--font-display)" }}
            >
              {s.title}
            </h2>
            <div
              className="mt-4 space-y-3 text-sm leading-relaxed"
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
