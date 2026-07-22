import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { getBookDemoHref, isExternalBookDemoHref } from "@/lib/marketing/book-demo";
import { PixelWordmark } from "@/components/home/pixel-wordmark";

// Flat, organized footer: wordmark + one link column per group, single
// hairline divider from the content above, plain copyright row below.
// No version strings, no locale/weather strips, no decorative dots.

type FooterLink = { label: string; href: string; external?: boolean };

export function PlatformFooter() {
  const year = new Date().getFullYear();

  const columns: Array<{ heading: string; links: FooterLink[] }> = [
    {
      heading: "Product",
      links: [
        { label: "Product",     href: "/features/pixel" },
        { label: "Pricing",     href: "/pricing" },
        { label: "See it live", href: "/demo" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About",     href: "/about" },
        { label: "Blog",      href: "/blog" },
        { label: "Solutions", href: "/student-housing" },
      ],
    },
    {
      heading: "Get started",
      links: [
        { label: "Book a demo", href: getBookDemoHref(), external: isExternalBookDemoHref() },
        { label: "Sign in",     href: "/sign-in" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms",   href: "/terms" },
      ],
    },
  ];

  return (
    <footer style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #e0e0e0" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Link href="/" className="flex items-center" aria-label="LeaseStack home">
              <img
                src="/logos/leasestack-wordmark.png"
                alt="LeaseStack"
                style={{ height: "36px", width: "auto", display: "block" }}
              />
            </Link>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <p
                style={{
                  color: "#6f7a94",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "12px",
                }}
              >
                {col.heading}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => {
                  const linkStyle = {
                    color: "#6f6f6f",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13.5px",
                    fontWeight: 400,
                    transition: "color 0.2s ease",
                  } as const;
                  return (
                    <li key={l.label}>
                      {l.external ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} style={linkStyle}>
                          {l.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3"
          style={{ borderTop: "1px solid #e0e0e0" }}
        >
          <p style={{ color: "#8d8d8d", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 400 }}>
            &copy; {year} {BRAND_NAME}
          </p>
        </div>
      </div>

      {/* Statement wordmark: a pixel-assembly moment. A field of brand square
          tiles converges into the "LeaseStack" wordmark on scroll, then a
          signal-pulse sweeps it once. On-brand with the Visitor Pixel motif;
          scales to width (no overflow). See components/home/pixel-wordmark. */}
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 pb-6">
        <PixelWordmark />
      </div>
    </footer>
  );
}
