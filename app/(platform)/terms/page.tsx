import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingHeader } from '@/components/marketing-header'

export const revalidate = 86400 // ISR: rebuild at most once per day

export const metadata: Metadata = {
  title: 'Terms of Service | Wholesail',
  description: 'Terms governing your use of the Wholesail wholesale distribution platform.',
  alternates: {
    canonical: 'https://wholesailhub.com/terms',
  },
}

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body: [
      'By accessing or using the Wholesail platform (wholesailhub.com), you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.',
      'We may update these terms from time to time. Continued use of the platform after changes are posted constitutes acceptance of the updated terms.',
    ],
  },
  {
    title: 'Platform Access',
    body: [
      'Wholesail is a B2B wholesale ordering platform. Access is restricted to verified wholesale buyers — restaurants, hotels, food service operators, and qualified catering and retail operations.',
      'Consumer purchases are not permitted. By creating an account, you represent that you are purchasing on behalf of a qualified business and hold any licenses required by law to purchase the products you order.',
    ],
  },
  {
    title: 'Account Requirements',
    body: [
      'You must provide accurate and complete information when creating your account. You are responsible for maintaining the confidentiality of your login credentials.',
      'You are responsible for all activity that occurs under your account. Notify us immediately at support@wholesailhub.com if you suspect unauthorized access.',
      'We reserve the right to suspend or terminate accounts that violate these terms, provide false information, or engage in fraudulent activity.',
    ],
  },
  {
    title: 'Orders and Payment',
    body: [
      'All orders are subject to availability and pricing at the time of order confirmation. We reserve the right to cancel or modify orders affected by inventory shortages or pricing errors, and will notify you promptly in such cases.',
      'Payment is due at the time of order unless you have approved NET terms on your account. Overdue balances may result in account suspension and late fees as specified on your invoice.',
      'Prices are quoted in USD and are exclusive of applicable taxes unless otherwise stated.',
    ],
  },
  {
    title: 'Cancellations and Returns',
    body: [
      'Order cancellations must be requested before shipment. Contact your account manager or support@wholesailhub.com.',
      'If a product arrives damaged, below grade, or does not match your order, contact us within 24 hours of delivery with photos. We will replace, credit, or refund at our discretion.',
      'Due to the perishable nature of many products, all sales are final once goods have been accepted and are in good condition.',
    ],
  },
  {
    title: 'Intellectual Property',
    body: [
      'All content on the Wholesail platform — including design, code, copy, and branding — is owned by Wholesail and may not be copied, reproduced, or distributed without written permission.',
      'You may not reverse engineer, scrape, or use automated tools to access or extract data from the platform.',
    ],
  },
  {
    title: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Wholesail is not liable for indirect, incidental, consequential, or punitive damages arising from your use of the platform or products purchased through it.',
      'Our total liability to you for any claim arising from your use of the platform shall not exceed the amount you paid us in the 30 days preceding the claim.',
    ],
  },
  {
    title: 'Governing Law',
    body: [
      'These terms are governed by the laws of the State of California, without regard to its conflict of law provisions.',
      'Any disputes arising from these terms or your use of the platform shall be resolved in the courts of Los Angeles County, California.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'For questions about these terms, contact us at support@wholesailhub.com.',
      'Wholesail — Los Angeles, CA',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <MarketingHeader />

      <div className="pt-24 pb-12 sm:pb-16 border-b border-shell">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <p className="text-xs tracking-[0.25em] uppercase text-sand mb-4">Legal</p>
          <h1 className="font-serif text-5xl sm:text-6xl font-bold text-ink leading-tight mb-4">
            Terms of Service
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
