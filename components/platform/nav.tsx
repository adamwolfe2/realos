"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Tesla-inspired: a transparent sticky nav that floats over the hero, turning
// to frosted white on scroll. Wordmark left, nav links centered, two utility
// links right. No shadow, no border. Single 14px weight-500 type system.

const PRODUCT_LINKS = [
  { href: "/features/pixel",   label: "Identity pixel" },
  { href: "/features/chatbot", label: "AI chatbot" },
  { href: "/features/seo-aeo", label: "SEO and AEO" },
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // DECISION: the homepage uses a full-viewport dark cinematic hero, so the
  // nav starts transparent with white text. On scroll it becomes opaque
  // white with dark text, matching Tesla's behavior. Every non-home page
  // starts in the opaque state so content is legible.
  const isHome = pathname === "/";
  const overDark = isHome && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const labelColor = overDark ? "#FFFFFF" : "#171A20";
  const navBtnClass = overDark ? "btn-nav btn-nav-on-dark" : "btn-nav";

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        backgroundColor: overDark ? "transparent" : "rgba(255,255,255,0.9)",
        backdropFilter: overDark ? "none" : "blur(18px)",
        WebkitBackdropFilter: overDark ? "none" : "blur(18px)",
        transition: "background-color 0.33s cubic-bezier(0.5, 0, 0, 0.75)",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center"
          style={{
            color: labelColor,
            fontFamily: "var(--font-display)",
            fontSize: "17px",
            fontWeight: 500,
            letterSpacing: "normal",
            transition: "color 0.33s cubic-bezier(0.5, 0, 0, 0.75)",
          }}
        >
          RealEstaite
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
          <NavLink
            href="/pricing"
            active={isActive(pathname, "/pricing")}
            overDark={overDark}
          >
            Pricing
          </NavLink>
          <Dropdown
            label="Compare"
            btnClass={navBtnClass}
            open={compareOpen}
            onOpenChange={setCompareOpen}
            items={[{ href: "/compare/conversion-logix", label: "vs Conversion Logix" }]}
            labelColor={labelColor}
          />
          <NavLink
            href="/blog"
            active={isActive(pathname, "/blog")}
            overDark={overDark}
          >
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
            className="inline-flex items-center justify-center rounded-[4px] transition-all"
            style={{
              minHeight: "32px",
              padding: "0 16px",
              backgroundColor: overDark ? "rgba(244,244,244,0.9)" : "var(--electric-blue)",
              color: overDark ? "#171A20" : "#FFFFFF",
              fontSize: "14px",
              fontWeight: 500,
              transition:
                "background-color 0.33s cubic-bezier(0.5, 0, 0, 0.75), color 0.33s cubic-bezier(0.5, 0, 0, 0.75)",
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
  overDark,
  children,
}: {
  href: string;
  active: boolean;
  overDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-[4px]"
      style={{
        minHeight: "32px",
        padding: "4px 12px",
        color: overDark ? "#FFFFFF" : "#171A20",
        fontFamily: "var(--font-sans)",
        fontSize: "14px",
        fontWeight: 500,
        opacity: active ? 1 : 0.92,
        transition:
          "color 0.33s cubic-bezier(0.5, 0, 0, 0.75), background-color 0.33s cubic-bezier(0.5, 0, 0, 0.75), opacity 0.33s",
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
            className="py-2 min-w-[240px]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #EEEEEE",
              borderRadius: "4px",
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
        { href: "/pricing", label: "Pricing" },
        { href: "/compare/conversion-logix", label: "vs Conversion Logix" },
        { href: "/blog", label: "Blog" },
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
                      padding: "8px 8px",
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
