"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Tesla-inspired: a transparent sticky nav that floats over the hero, turning
// to frosted white on scroll. Wordmark left, nav links centered, two utility
// links right. No shadow, no border. Single 14px weight-500 type system.

const PRODUCT_LINKS = [
  { href: "/features/pixel",   label: "Visitor identification" },
  { href: "/features/chatbot", label: "AI chatbot" },
  { href: "/features/seo-aeo", label: "Search + AI discovery" },
  { href: "/features/ads",     label: "Managed ads" },
];

const VERTICAL_LINKS = [
  { href: "/student-housing", label: "Student housing" },
  { href: "/multifamily",     label: "Multifamily" },
  { href: "/senior-living",   label: "Senior living" },
  { href: "/commercial",      label: "Commercial" },
];

export function PlatformNav() {
  const pathname = usePathname();
  const [productOpen, setProductOpen] = useState(false);
  const [verticalOpen, setVerticalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Claude-inspired nav: always light parchment canvas with a translucent
  // blur on scroll. No dark mode flip; the homepage canvas is warm all the way
  // down, so we don't need an overlay state.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const labelColor = "#141413";
  const navBtnClass = "btn-nav";

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        backgroundColor: scrolled
          ? "rgba(245,244,237,0.85)"
          : "rgba(245,244,237,0.98)",
        backdropFilter: scrolled ? "blur(18px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(18px)" : "none",
        borderBottom: scrolled ? "1px solid #f0eee6" : "1px solid transparent",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center" aria-label="LeaseStack home">
          <img
            src="/logos/leasestack-wordmark.svg"
            alt="LeaseStack"
            height={56}
            style={{
              height: "56px",
              width: "auto",
              display: "block",
            }}
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          <Dropdown
            label="Product"
            btnClass={navBtnClass}
            open={productOpen}
            onOpenChange={setProductOpen}
            items={PRODUCT_LINKS}
            labelColor={labelColor}
          />
          <Dropdown
            label="Solutions"
            btnClass={navBtnClass}
            open={verticalOpen}
            onOpenChange={setVerticalOpen}
            items={VERTICAL_LINKS}
            labelColor={labelColor}
          />
          <NavLink href="/blog" active={isActive(pathname, "/blog")}>
            Blog
          </NavLink>
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href="/sign-in"
            className={`hidden md:inline-flex ${navBtnClass}`}
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center"
            style={{
              minHeight: "36px",
              padding: "8px 16px",
              backgroundColor: "#2F6FE5",
              color: "#faf9f5",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "10px",
              boxShadow: "0 0 0 1px #2F6FE5 inset",
              transition: "background-color 0.2s ease",
            }}
          >
            Book a demo
          </Link>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-[4px]"
            style={{ color: labelColor, transition: "color 0.33s" }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              {mobileOpen ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              ) : (
                <path d="M3 6h12M3 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen ? <MobileMenu onClose={() => setMobileOpen(false)} /> : null}
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center"
      style={{
        minHeight: "36px",
        padding: "6px 12px",
        borderRadius: "10px",
        color: "#141413",
        fontFamily: "var(--font-sans)",
        fontSize: "15px",
        fontWeight: 500,
        backgroundColor: active ? "#e8e6dc" : "transparent",
        transition: "background-color 0.2s ease",
      }}
    >
      {children}
    </Link>
  );
}

function Dropdown({
  label,
  open,
  btnClass,
  onOpenChange,
  items,
  labelColor,
}: {
  label: string;
  btnClass: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: Array<{ href: string; label: string }>;
  labelColor: string;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
    >
      <button
        type="button"
        className={btnClass}
        style={{ color: labelColor }}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        {label}
      </button>
      {open ? (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
          <ul
            className="py-2 min-w-[260px]"
            style={{
              backgroundColor: "#faf9f5",
              boxShadow:
                "0 0 0 1px #f0eee6, 0 12px 28px rgba(0,0,0,0.06)",
              borderRadius: "14px",
            }}
          >
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-4 py-2.5"
                  style={{
                    color: "#171A20",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "background-color 0.33s",
                  }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const sections: Array<{
    title: string;
    items: Array<{ href: string; label: string }>;
  }> = [
    { title: "Product", items: PRODUCT_LINKS },
    { title: "Solutions", items: VERTICAL_LINKS },
    {
      title: "Company",
      items: [
        { href: "/blog", label: "Blog" },
        { href: "/about", label: "About" },
        { href: "/manifesto", label: "Manifesto" },
        { href: "/sign-in", label: "Sign in" },
      ],
    },
  ];
  return (
    <div
      className="md:hidden"
      style={{
        borderTop: "1px solid #EEEEEE",
        backgroundColor: "#FFFFFF",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-5">
        {sections.map((s) => (
          <div key={s.title}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                color: "#5C5E62",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                marginBottom: "8px",
              }}
            >
              {s.title}
            </p>
            <ul className="space-y-1">
              {s.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onClose}
                    style={{
                      display: "block",
                      padding: "12px 8px",
                      color: "#171A20",
                      fontSize: "16px",
                      fontWeight: 500,
                    }}
                  >
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function isActive(pathname: string | null, prefix: string): boolean {
  return (
    pathname === prefix ||
    (prefix !== "/" && (pathname ?? "").startsWith(prefix))
  );
}
