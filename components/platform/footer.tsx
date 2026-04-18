import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

// DECISION: Footer shares the page canvas (no contrast step). Separated from
// content only by a translucent hairline. Linear does this: the footer is
// just the bottom third of the same dark room.

export function PlatformFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-16 pb-10 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2 md:col-span-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded"
              style={{
                backgroundColor: "var(--accent)",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.1) inset, 0 0 24px var(--accent-glow)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2 9.5V4l4-2.5 4 2.5v5.5"
                  stroke="white"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M2 9.5h8" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="6" cy="7" r="1" fill="white" />
              </svg>
            </span>
            <span
              className="text-[15px]"
              style={{ color: "var(--text-headline)", fontWeight: 510 }}
            >
              RealEstaite
            </span>
          </Link>
          <p
            className="mt-4 text-[14px] leading-relaxed max-w-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Managed marketing infrastructure for real estate operators. Custom
            site, live listings, identity pixel, AI chatbot, managed ads. One
            retainer. Launched in two weeks.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 text-[13px] px-3.5 py-2 rounded-md btn-accent"
              style={{ fontWeight: 510 }}
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-[13px] px-3.5 py-2 rounded-md btn-ghost"
              style={{ fontWeight: 510 }}
            >
              Pricing
            </Link>
          </div>
        </div>

        <FooterColumn
          title="Product"
          items={[
            { href: "/features/pixel",   label: "Identity pixel" },
            { href: "/features/chatbot", label: "AI chatbot" },
            { href: "/features/seo-aeo", label: "SEO and AEO" },
            { href: "/features/ads",     label: "Managed ads" },
            { href: "/pricing",          label: "Pricing" },
            { href: "/compare/conversion-logix", label: "vs Conversion Logix" },
          ]}
        />

        <FooterColumn
          title="Solutions"
          items={[
            { href: "/student-housing", label: "Student housing" },
            { href: "/multifamily",     label: "Multifamily" },
            { href: "/senior-living",   label: "Senior living" },
            { href: "/commercial",      label: "Commercial" },
            { href: "/residential",     label: "Residential" },
          ]}
        />

        <FooterColumn
          title="Company"
          items={[
            { href: "/about",   label: "About" },
            { href: "/blog",    label: "Blog" },
            { href: "/tools",   label: "Tools" },
            { href: "/sign-in", label: "Sign in" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms",   label: "Terms" },
          ]}
        />
      </div>

      <div
        className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-2 md:justify-between text-[12px]"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          color: "var(--text-subtle)",
        }}
      >
        <span>
          &copy; {year} {BRAND_NAME}. All rights reserved.
        </span>
        <span>Built for operators, not agencies.</span>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="space-y-2.5 text-[13px]">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="link-body transition-colors"
              style={{ color: "var(--text-muted)", fontWeight: 510 }}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
