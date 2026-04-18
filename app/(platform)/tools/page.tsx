import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tools, free calculators and audits for real estate operators",
  description:
    "Free calculators coming soon: property marketing audit, rent price analyzer, move-in checklist generator, campus distance calculator.",
};

const TOOLS = [
  {
    key: "marketing-audit",
    title: "Property marketing audit",
    body:
      "Drop your site URL. We'll grade site speed, SEO basics, chatbot presence, and lead capture paths.",
  },
  {
    key: "rent-price-analyzer",
    title: "Rent price analyzer",
    body:
      "Compare your unit pricing against nearby comps and occupancy rates. Good for pre-season calibration.",
  },
  {
    key: "move-in-checklist",
    title: "Move-in checklist generator",
    body:
      "Share with prospective tenants to speed up move-in day. Customizable with your community's rules.",
  },
  {
    key: "campus-distance",
    title: "Campus distance calculator",
    body:
      "For student housing: accurate walk + bike + transit time to specific campus buildings. Embed on your site.",
  },
];

export default function ToolsPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-20">
      <p className="text-[11px] tracking-widest uppercase opacity-60 mb-3">
        Tools
      </p>
      <h1 className="font-serif text-4xl md:text-5xl font-bold">
        Free tools, coming on a rolling basis.
      </h1>
      <p className="mt-5 text-lg opacity-80 max-w-2xl">
        Lead magnets we're building for operators. Join the waitlist for any
        of them and we'll email you the day they ship.
      </p>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOOLS.map((t) => (
          <div key={t.key} className="border rounded-lg p-6">
            <h2 className="font-serif text-xl font-bold">{t.title}</h2>
            <p className="mt-2 text-sm opacity-80">{t.body}</p>
            <p className="mt-4 text-[11px] tracking-widest uppercase opacity-60">
              Coming soon
            </p>
            <Link
              href={`/onboarding?tool=${t.key}`}
              className="mt-3 inline-block text-xs font-semibold underline"
            >
              Join the waitlist →
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
