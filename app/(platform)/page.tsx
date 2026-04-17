import Link from "next/link";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description:
    "Custom-built websites, live listings, AI chatbot, ad pixel, and ad creative, all managed by us. Built for student housing, multifamily, and senior living operators.",
};

// TODO(Sprint 12): rebuild the platform homepage (hero, value props, verticals,
// pricing, Conversion Logix comparison, case study, consultation booking).
// Sprint 12 rewrites this from scratch with real-estate marketing copy.
export default function PlatformHome() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24 text-center">
      <div className="max-w-2xl">
        <p className="text-xs tracking-widest uppercase opacity-60 mb-4">
          {BRAND_NAME}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6">
          Managed marketing for real estate operators.
        </h1>
        <p className="text-lg opacity-80 mb-8">
          Website, live listings, AI chatbot, ad pixel, ad creative. All
          managed by us. Launched in two weeks.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/onboarding"
            className="inline-block bg-black text-white px-6 py-3 text-sm font-medium tracking-wide"
          >
            Start intake
          </Link>
          <Link
            href="/admin"
            className="inline-block border border-black px-6 py-3 text-sm font-medium tracking-wide"
          >
            Agency admin
          </Link>
        </div>
        <p className="mt-12 text-xs opacity-50">
          Platform homepage copy is scaffolded in Sprint 12.
        </p>
      </div>
    </main>
  );
}
