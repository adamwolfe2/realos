import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

// Tesla-style footer: white canvas, small gray muted 14px links in three
// centered columns above a thin 12px legal row. No shadows, no borders
// except a single hairline dividing it from the content above.

export function PlatformFooter() {
  const year = new Date().getFullYear();
  const links: Array<{ label: string; href: string }> = [
    { label: "Demo",              href: "/onboarding" },
    { label: "Product",           href: "/features/pixel" },
    { label: "See it live",       href: "/#live" },
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
        backgroundColor: "#F4F4F4",
        borderTop: "1px solid #EEEEEE",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <Link href="/" className="flex items-center" aria-label="LeaseStack home">
          <img
            src="/logos/leasestack-wordmark.svg"
            alt="LeaseStack"
            style={{ height: "44px", width: "auto", display: "block", opacity: 0.85 }}
          />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                color: "#5C5E62",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: 400,
                transition: "color 0.33s",
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p
          style={{
            color: "#8E8E8E",
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
