import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingHeader } from '@/components/marketing-header'

export const revalidate = 86400 // ISR: rebuild at most once per day

export const metadata: Metadata = {
  title: 'Privacy Policy | Wholesail',
  description: 'How Wholesail collects, uses, and protects your personal information.',
  alternates: {
    canonical: 'https://wholesailhub.com/privacy',
  },
}

const SECTIONS = [
  {
    title: 'Information We Collect',
    body: [
      'We collect information you provide directly — name, email address, phone number, business name, and payment details — when you apply for wholesale access, create an account, or place an order.',
      'We also collect usage data automatically, including IP address, browser type, pages visited, and actions taken on the platform. This information helps us improve the service and diagnose technical issues.',
    ],
  },
  {
    title: 'How We Use Your Information',
    body: [
      'To process orders and send order confirmations, invoices, and delivery updates.',
      'To manage your account and provide customer support.',
      'To send transactional communications related to your account (password resets, application status, billing).',
      'To improve the platform based on usage patterns and feedback.',
      'We do not sell your personal information to third parties.',
    ],
  },
  {
    title: 'Third-Party Services',
    body: [
      'Clerk — We use Clerk for authentication and account management. Clerk may store your name, email, and session data. See clerk.com/privacy.',
      'Stripe — Payment processing is handled by Stripe, Inc. Card details are never stored on our servers. See stripe.com/privacy.',
      'Resend — Transactional emails are sent via Resend. Your email address is transmitted to Resend solely for delivery purposes. See resend.com/privacy.',
      'These services operate under their own privacy policies and security standards.',
    ],
  },
  {
    title: 'Data Retention',
    body: [
      'We retain your account information for as long as your account is active. Order records are retained for a minimum of seven years to comply with applicable accounting and tax requirements.',
      'You may request deletion of your account and personal data at any time by emailing privacy@wholesailhub.com. We will fulfill requests within 30 days, subject to legal retention obligations.',
    ],
  },
  {
    title: 'Your Rights',
    body: [
      'You have the right to access, correct, or delete personal information we hold about you.',
      'You may opt out of non-transactional communications at any time via the unsubscribe link in any email or by contacting us directly.',
      'If you are located in California, you may have additional rights under the California Consumer Privacy Act (CCPA).',
    ],
  },
  {
    title: 'Security',
    body: [
      'We use industry-standard encryption (TLS) for data in transit and follow security best practices for data at rest. Access to personal data is restricted to personnel who require it to operate the platform.',
      'No system is perfectly secure. If you believe your account has been compromised, contact us immediately at privacy@wholesailhub.com.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'For privacy-related requests or questions, contact us at privacy@wholesailhub.com.',
      'Wholesail — Los Angeles, CA',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream">
      <MarketingHeader />

      <div className="pt-24 pb-12 sm:pb-16 border-b border-shell">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <p className="text-xs tracking-[0.25em] uppercase text-sand mb-4">Legal</p>
          <h1 className="font-serif text-5xl sm:text-6xl font-bold text-ink leading-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-ink/40">Last Updated: March 2026</p>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-16 sm:py-20">
        <div className="space-y-14">
          {SECTIONS.map((section, i) => (
            <section key={section.title}>
              <div className="flex items-start gap-5 mb-6">
                <span className="font-serif text-3xl font-normal text-shell leading-none select-none shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
                  {section.title}
                </h2>
              </div>
              <div className="pl-0 sm:pl-14 space-y-3">
                {section.body.map((paragraph, j) => (
                  <p key={j} className="text-ink/70 text-base leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
              {i < SECTIONS.length - 1 && (
                <div className="border-t border-shell mt-14" />
              )}
            </section>
          ))}
        </div>
      </div>

      <footer className="border-t border-shell bg-ink-dark text-cream py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link href="/" className="font-serif text-xl font-bold">Wholesail</Link>
          <div className="flex items-center gap-6 text-sm text-cream/40">
            <Link href="/privacy" className="hover:text-cream transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-cream transition-colors">Terms of Service</Link>
            <Link href="/about" className="hover:text-cream transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
