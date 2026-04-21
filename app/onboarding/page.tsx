import type { Metadata } from "next";
import { IntakeWizard } from "@/components/intake";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Get started with ${BRAND_NAME}`,
  description:
    "Tell us about your real estate portfolio. We'll come to the call with a marketing plan tailored to your property type, backend, and growth goals.",
  robots: { index: true, follow: true },
};

export default function OnboardingPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 pb-28 sm:pb-12">
      <header className="mb-8">
        <p className="text-xs tracking-widest uppercase opacity-60 mb-3">
          Intake
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3">
          Tell us about your portfolio.
        </h1>
        <p className="opacity-80">
          Four quick steps. We review every submission personally before the
          call so we skip discovery and jump straight to building your
          marketing stack.
        </p>
      </header>
      <IntakeWizard />
    </main>
  );
}
