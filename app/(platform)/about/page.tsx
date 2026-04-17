import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: `${BRAND_NAME} is the managed marketing platform for real estate operators, student housing, multifamily, and senior living.`,
};

// TODO(Sprint 12): rewrite the About page with real-estate-operator positioning
// and case study content.
export default function AboutPage() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-24">
      <p className="text-xs tracking-widest uppercase opacity-60 mb-4">
        About {BRAND_NAME}
      </p>
      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-8">
        Marketing that lives where your residents search.
      </h1>
      <p className="text-lg opacity-80 mb-6">
        {BRAND_NAME} gives independent real estate operators a full marketing
        stack: custom website with live listings, AI chatbot, identity pixel,
        lead capture, and managed ads. We handle the build, the copy, the
        creative, and the reporting. You pay a flat monthly retainer.
      </p>
      <p className="text-lg opacity-80 mb-12">
        The platform was built for student housing first and extends to
        multifamily, senior living, and co-living operators who are paying big
        marketing agencies and getting mediocre results.
      </p>
      <Link
        href="/onboarding"
        className="inline-block bg-black text-white px-6 py-3 text-sm font-medium tracking-wide"
      >
        Start the intake
      </Link>
    </main>
  );
}
