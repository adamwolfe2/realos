import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { getBookDemoHref, isExternalBookDemoHref } from "@/lib/marketing/book-demo";

// Tesla-style footer: white canvas, small gray muted 14px links in three
// centered columns above a thin 12px legal row. No shadows, no borders
// except a single hairline dividing it from the content above.

export function PlatformFooter() {
  const year = new Date().getFullYear();
  const links: Array<{ label: string; href: string; external?: boolean }> = [
    { label: "Demo",              href: getBookDemoHref(), external: isExternalBookDemoHref() },
    { label: "Product",           href: "/features/pixel" },
    { label: "Pricing",           href: "/pricing" },
    { label: "See it live",       href: "/demo" },
    { label: "Solutions",         href: "/student-housing" },
    { label: "Blog",              href: "/blog" },
    { label: "About",             href: "/about" },
    { label: "Sign in",           href: "/sign-in" },
    { label: "Privacy",           href: "/privacy" },
    { label: "Terms",             href: "/terms" },
  ];

  return (
    <footer
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <Link href="/" className="flex items-center" aria-label="LeaseStack home">
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            style={{ height: "44px", width: "auto", display: "block", opacity: 0.85 }}
          />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((l) => {
            const sharedStyle = {
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 400,
              transition: "color 0.2s",
            } as const;
            if (l.external) {
              return (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={sharedStyle}
                >
                  {l.label}
                </a>
              );
            }
            return (
              <Link key={l.label} href={l.href} style={sharedStyle}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <p
          style={{
            color: "#94A3B8",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 400,
          }}
        >
          &copy; {year} {BRAND_NAME}
        </p>
      </div>
    </footer>
  );
}
