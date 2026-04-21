import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy policy for ${BRAND_NAME}.`,
};

export const revalidate = 86400;

const SECTIONS = [
  {
    title: "Information we collect",
    body: [
      "We collect information you provide directly, your name, email address, phone number, business name, and payment details, when you request a demo, create an account, or sign a contract.",
      "We collect information automatically through cookies and pixels, including device type, browser, IP address, and pages viewed. We use this to improve the product and attribute marketing sources.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "We use your information to provide and improve the platform, to communicate with you about your account, to process payments, and to comply with legal obligations.",
      "We may aggregate and anonymize data for analytics and product research. Aggregated, non-identifying data is not subject to this policy.",
    ],
  },
  {
    title: "Sharing with third parties",
    body: [
      "Clerk, we use Clerk for authentication and account management. Clerk may store your name, email, and session data. See clerk.com/privacy.",
      "Stripe, payment processing is handled by Stripe. Card details are never stored on our servers. See stripe.com/privacy.",
      "Resend, transactional emails are sent via Resend. Your email address is transmitted to Resend solely for delivery. See resend.com/privacy.",
      "Cursive, if you opt into the identity graph pixel, visitor data flows through Cursive. See cursive.io.",
      "AppFolio, if you integrate your AppFolio account, we pull publicly-listed unit data through your account. We never modify AppFolio records.",
    ],
  },
  {
    title: "Retention",
    body: [
      "We retain account data for as long as your account is active. You can request deletion by emailing us. We retain billing records for seven years to satisfy tax and accounting rules.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can request access, correction, or deletion of your personal information at any time. For California residents, your rights under CCPA apply; we do not sell your personal information.",
    ],
  },
  {
    title: "Contact",
    body: [`${BRAND_NAME}, San Diego, California.`, process.env.RESEND_FROM_EMAIL ?? "hello@leasestack.co"],
  },
];

export default function PrivacyPage() {
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
            Privacy policy
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
