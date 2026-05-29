"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Tesla-inspired: a transparent sticky nav that floats over the hero, turning
// to frosted white on scroll. Wordmark left, nav links centered, two utility
// links right. No shadow, no border. Single 14px weight-500 type system.

// Features dropdown — Norman brief (2026-05-28): two items only.
// "Core LeaseStack Platform" points to the platform overview page.
// "Add-ons" lists the modules in priority order.
const PRODUCT_LINKS = [
  { href: "/features",         label: "Core LeaseStack Platform" },
  { href: "/features/chatbot", label: "Add-on · AI Chatbot" },
  { href: "/features/pixel",   label: "Add-on · Visitor Identification" },
  { href: "/features/seo-aeo", label: "Add-on · SEO / AEO" },
  { href: "/audit",            label: "Add-on · Reputation Management" },
  { href: "/features/seo-aeo", label: "Add-on · Keyword Trends" },
  { href: "/features/ads",     label: "Add-on · Managed Ads oversight" },
  { href: "/features",         label: "Add-on · Website Build" },
];

// Solutions / Verticals — hidden from the nav per Norman brief but kept
// here so the underlying pages remain referenced from the mobile menu.
// Routes stay live for SEO.
const VERTICAL_LINKS = [
  { href: "/student-housing", label: "Student housing" },
  { href: "/multifamily",     label: "Multifamily" },
  { href: "/senior-living",   label: "Senior living" },
  { href: "/commercial",      label: "Commercial" },
];

export function PlatformNav() {
  const pathname = usePathname();
  const [productOpen, setProductOpen] = useState(false);
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

  // Norman 2026-05-21: nav should glide into a floating glass-morphism
  // pill as the user scrolls away from the hero, then expand back to a
  // full-width edge-aligned bar when they return to the top.
  //
  // Implementation:
  //   - Outer <header> stays sticky + transparent so the inner shell
  //     can freely change width / radius / background without losing
  //     its scroll anchoring.
  //   - Inner shell (`<div data-floating>`) uses CSS transitions on
  //     max-width, border-radius, background, backdrop-filter,
  //     box-shadow, margin, and padding so the morph is one smooth
  //     500ms animation instead of a snap.
  //   - Threshold-driven (>20px) rather than progress-driven so we
  //     don't repaint on every scroll frame.
  return (
    <header
      className="sticky top-0 z-40"
      style={{
        // Transparent outer so the inner shell defines the chrome.
        backgroundColor: "transparent",
        // Tiny top inset that animates in when floating so the pill
        // doesn't kiss the top edge of the viewport.
        paddingTop: scrolled ? 10 : 0,
        transition: "padding-top 500ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        data-floating={scrolled ? "true" : "false"}
        className="mx-auto h-16 md:h-[68px] flex items-center justify-between gap-4"
        style={{
          // Width morph: edge-to-edge at top, floating pill on scroll.
          // The 1180px cap reads as a comfortable laptop width.
          maxWidth: scrolled ? "min(1180px, calc(100% - 24px))" : "100%",
          // Horizontal padding inside the shell — slightly tighter
          // when floating so the content sits closer to the rounded
          // edges of the pill.
          paddingLeft: scrolled ? 20 : 16,
          paddingRight: scrolled ? 12 : 16,
          // Glass-morphism chrome — opaque at top, frosted floating.
          backgroundColor: scrolled
            ? "rgba(255, 255, 255, 0.72)"
            : "rgba(255, 255, 255, 1)",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled
            ? "blur(20px) saturate(180%)"
            : "none",
          // Rounded corners only when floating. At top, the bar reads
          // as a flush edge with a hairline divider.
          borderRadius: scrolled ? 18 : 0,
          // Subtle ring + lifted shadow when floating; hairline bottom
          // border at top. Both interpolate through the same CSS prop
          // (boxShadow) so the morph reads as a single animation.
          boxShadow: scrolled
            ? "0 0 0 1px rgba(15, 23, 42, 0.06), 0 12px 36px rgba(15, 23, 42, 0.10)"
            : "inset 0 -1px 0 #E2E8F0",
          transition:
            "max-width 500ms cubic-bezier(0.22, 1, 0.36, 1)," +
            " padding-left 500ms cubic-bezier(0.22, 1, 0.36, 1)," +
            " padding-right 500ms cubic-bezier(0.22, 1, 0.36, 1)," +
            " background-color 350ms ease," +
            " backdrop-filter 350ms ease," +
            " -webkit-backdrop-filter 350ms ease," +
            " border-radius 500ms cubic-bezier(0.22, 1, 0.36, 1)," +
            " box-shadow 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Link href="/" className="flex items-center" aria-label="LeaseStack home">
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            className="h-7 md:h-10 w-auto block"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          <NavLink href="/" active={pathname === "/"}>
            Home
          </NavLink>
          <Dropdown
            label="Features"
            btnClass={navBtnClass}
            open={productOpen}
            onOpenChange={setProductOpen}
            items={PRODUCT_LINKS}
            labelColor={labelColor}
          />
          <NavLink href="/pricing" active={isActive(pathname, "/pricing")}>
            Pricing
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
    { href: "/", label: "Home" },
    ...PRODUCT_LINKS,
    ...VERTICAL_LINKS,
    { href: "/pricing", label: "Pricing" },
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
