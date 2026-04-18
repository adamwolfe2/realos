import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { MARKETING } from "@/lib/copy/marketing";

export function PlatformFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-24"
      style={{
        backgroundColor: "var(--bg-blue-dark)",
        color: "var(--text-on-blue)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
        <div className="col-span-2">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.15em] mb-4"
            style={{ opacity: 0.6 }}
          >
            {BRAND_NAME}
          </p>
          <p className="font-serif text-2xl md:text-3xl font-normal leading-tight max-w-sm">
            {MARKETING.brand.tagline}.
          </p>
          <p
            className="font-mono text-xs mt-4 max-w-sm"
            style={{ opacity: 0.7 }}
          >
            Book a 30 minute demo. We audit your current marketing invoice on
            the call.
          </p>
          <Link
            href="/onboarding"
            className="inline-block mt-6 font-mono text-xs font-semibold px-5 py-3 rounded"
            style={{
              backgroundColor: "white",
              color: "var(--bg-blue-dark)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Book a demo
          </Link>
        </div>
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-[0.15em] mb-4"
            style={{ opacity: 0.55 }}
          >
            Product
          </p>
          <ul className="space-y-2 font-mono text-xs" style={{ opacity: 0.85 }}>
            <li><Link href="/features/pixel">Identity pixel</Link></li>
            <li><Link href="/features/chatbot">AI chatbot</Link></li>
            <li><Link href="/features/seo-aeo">SEO and AEO</Link></li>
            <li><Link href="/features/ads">Managed ads</Link></li>
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/compare/conversion-logix">Compare</Link></li>
          </ul>
        </div>
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-[0.15em] mb-4"
            style={{ opacity: 0.55 }}
          >
            Company
          </p>
          <ul className="space-y-2 font-mono text-xs" style={{ opacity: 0.85 }}>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/tools">Tools</Link></li>
            <li><Link href="/residential">Residential</Link></li>
            <li><Link href="/commercial">Commercial</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div
        className="max-w-6xl mx-auto px-4 md:px-6 py-5 flex flex-col md:flex-row gap-2 md:justify-between"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span className="font-mono text-[11px]" style={{ opacity: 0.55 }}>
          © {year} {BRAND_NAME}. All rights reserved.
        </span>
        <span className="font-mono text-[11px]" style={{ opacity: 0.55 }}>
          Built for operators. Not agencies.
        </span>
      </div>
    </footer>
  );
}
