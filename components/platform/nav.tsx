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
  { href: "/audiences",        label: "Audience Sync" },
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

  const labelColor = "#1E2A3A";
  const navBtnClass = "btn-nav";

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        backgroundColor: scrolled
          ? "rgba(255,255,255,0.85)"
          : "rgba(255,255,255,1)",
        backdropFilter: scrolled ? "blur(18px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(18px)" : "none",
        borderBottom: scrolled ? "1px solid #E2E8F0" : "1px solid transparent",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center" aria-label="LeaseStack home">
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            className="h-8 md:h-14 w-auto block"
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
          <NavLink href="/pricing" active={isActive(pathname, "/pricing")}>
            Pricing
          </NavLink>
          <NavLink href="/blog" active={isActive(pathname, "/blog")}>
            Blog
          </NavLink>
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/sign-in"
              className={navBtnClass}
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center"
              style={{
                minHeight: "36px",
                padding: "8px 16px",
                backgroundColor: "#2563EB",
                color: "#F1F5F9",
                fontSize: "14px",
                fontWeight: 500,
                borderRadius: "3px",
                boxShadow: "0 0 0 1px #2563EB inset",
                transition: "background-color 0.2s ease",
              }}
            >
              Book a demo
            </Link>
          </div>
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
        borderRadius: "3px",
        color: "#1E2A3A",
        fontFamily: "var(--font-sans)",
        fontSize: "15px",
        fontWeight: 500,
        backgroundColor: active ? "#E2E8F0" : "transparent",
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
              backgroundColor: "#F1F5F9",
              boxShadow:
                "0 0 0 1px #E2E8F0, 0 12px 28px rgba(0,0,0,0.06)",
              borderRadius: "14px",
            }}
          >
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-4 py-2.5"
                  style={{
                    color: "#1E2A3A",
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
  const allLinks = [
    ...PRODUCT_LINKS,
    ...VERTICAL_LINKS,
    { href: "/pricing", label: "Pricing" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
    { href: "/sign-in", label: "Sign in" },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 md:hidden flex flex-col"
        style={{ backgroundColor: "#F1F5F9" }}
      >
        <style jsx>{`
          @keyframes menuSlideIn {
            0%   { opacity: 0; transform: scale(0.94) translateY(-12px); }
            60%  { opacity: 1; transform: scale(1.02) translateY(2px); }
            80%  { transform: scale(0.99) translateY(-1px); }
            100% { transform: scale(1) translateY(0); }
          }
          .menu-panel {
            animation: menuSlideIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }
          @keyframes linkPop {
            0%   { opacity: 0; transform: translateX(-10px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .menu-link {
            animation: linkPop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }
        `}</style>

        <div className="menu-panel flex flex-col h-full px-5 pt-5 pb-8">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" onClick={onClose} aria-label="LeaseStack home">
              <img
                src="/logos/leasestack-wordmark.png"
                alt="LeaseStack"
                className="h-8 w-auto block"
              />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full"
              style={{ backgroundColor: "#E2E8F0", color: "#1E2A3A" }}
              aria-label="Close menu"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center gap-1">
            {allLinks.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="menu-link"
                style={{
                  display: "block",
                  padding: "11px 12px",
                  borderRadius: "3px",
                  color: "#1E2A3A",
                  fontSize: "18px",
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                  animationDelay: `${i * 35}ms`,
                  transition: "background-color 0.15s ease",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6">
            <Link
              href="/onboarding"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "52px",
                borderRadius: "3px",
                backgroundColor: "#2563EB",
                color: "#F1F5F9",
                fontSize: "16px",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
              }}
            >
              Book a demo
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function isActive(pathname: string | null, prefix: string): boolean {
  return (
    pathname === prefix ||
    (prefix !== "/" && (pathname ?? "").startsWith(prefix))
  );
}
