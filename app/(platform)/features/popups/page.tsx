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
            save-saves, design them visually, embed with a single script tag,
            and every conversion attributes back to your lead pipeline. Try the
            full editor below.
          </p>
          <div className="mt-8 inline-flex items-center gap-3">
            <a
              href="/sign-up"
              className="inline-flex items-center rounded-none bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Request pilot
            </a>
            <a
              href="/onboarding"
              className="inline-flex items-center rounded-none border border-border bg-white px-5 py-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Book a demo
            </a>
          </div>
        </div>
      </section>

      {/* Interactive demo — the page IS the hero + this demo (Adam 2026-07-24) */}
      <PopupsDemoSection />
    </div>
  );
}
