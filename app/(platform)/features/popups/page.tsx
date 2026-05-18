import type { Metadata } from "next";
import { PopupsDemoSection } from "@/components/platform/popups-demo-section";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Embeddable popups · ${BRAND_NAME}`,
  description:
    "Design promo, referral, and discount popups in 90 seconds. Paste a single script tag on any site. Every conversion attributes back to your lead pipeline.",
};

export default function PopupsFeaturePage() {
  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 md:pt-28 pb-10 md:pb-16">
        <div className="max-w-3xl">
          <p className="text-[11px] tracking-[0.22em] font-semibold uppercase text-primary mb-4">
            Embeddable popups · live demo
          </p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] text-foreground">
            Design popups that convert.
            <br />
            <span className="text-primary">Paste one line of code.</span>
          </h1>
          <p className="mt-5 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            Promo offers, referral programs, application reminders, exit-intent
            save-saves — design them visually, embed with a single script tag,
            and every conversion attributes back to your lead pipeline. Try the
            full editor below.
          </p>
        </div>
      </section>

      {/* Interactive demo */}
      <PopupsDemoSection />

      {/* Why this matters */}
      <section className="bg-[#F9FAFB] border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <p className="text-[11px] tracking-[0.18em] font-semibold uppercase text-primary mb-3">
              Built for operators
            </p>
            <h3 className="text-xl font-semibold tracking-tight mb-2">
              Works on any website
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Wix, WordPress, Webflow, Squarespace, custom — anywhere you can
              paste a script tag. The popup loads asynchronously so it never
              blocks your page render.
            </p>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.18em] font-semibold uppercase text-primary mb-3">
              Real attribution
            </p>
            <h3 className="text-xl font-semibold tracking-tight mb-2">
              Conversions hit your pipeline
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every email captured becomes a lead in /portal/leads with source
              tagged. Every dismiss, click, and conversion writes an event so
              you can A/B test headlines with real numbers.
            </p>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.18em] font-semibold uppercase text-primary mb-3">
              Smart frequency
            </p>
            <h3 className="text-xl font-semibold tracking-tight mb-2">
              No popup fatigue
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Once-per-session by default. Per-page allowlist. Mobile-aware
              triggers. The visitor sees one well-timed offer, not five
              competing modals.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          Live on your site in 5 minutes.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          The Popups module is included in the {BRAND_NAME} platform. Design
          your first campaign during the intake call.
        </p>
        <div className="mt-8 inline-flex items-center gap-3">
          <a
            href="/onboarding"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Book a demo
          </a>
          <a
            href="/demo"
            className="inline-flex items-center rounded-md border border-border bg-white px-5 py-3 text-sm font-semibold hover:bg-muted transition-colors"
          >
            See the platform
          </a>
        </div>
      </section>
    </div>
  );
}
