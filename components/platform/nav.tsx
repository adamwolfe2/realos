"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// DECISION: Linear-inspired dark sticky header. Near-black panel background
// (#0f1011), translucent white border underneath, 13px weight-510 links in
// silver-gray, indigo CTA on the right. No cream, no serif, no mono for the
// wordmark. Hover reveals a dropdown card with its own translucent chrome.

const PRODUCT_LINKS = [
  { href: "/features/pixel",   label: "Identity pixel", hint: "Name your anonymous traffic" },
  { href: "/features/chatbot", label: "AI chatbot",     hint: "Captures leads at 2 a.m." },
  { href: "/features/seo-aeo", label: "SEO and AEO",    hint: "Google and ChatGPT, both" },
  { href: "/features/ads",     label: "Managed ads",    hint: "Creative in 48 hours" },
];

const VERTICAL_LINKS = [
  { href: "/student-housing", label: "Student housing", hint: "Sprint pricing, turn-heavy calendar" },
  { href: "/multifamily",     label: "Multifamily",     hint: "Portfolio rollups + fair housing" },
  { href: "/senior-living",   label: "Senior living",   hint: "Family-first, patient nurture" },
  { href: "/commercial",      label: "Commercial",      hint: "Coming Q3" },
];

export function PlatformNav() {
  const pathname = usePathname();
  const [productOpen, setProductOpen] = useState(false);
  const [verticalOpen, setVerticalOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        backgroundColor: "rgba(15, 16, 17, 0.82)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark />
          <span
            className="text-[15px]"
            style={{
              color: "var(--text-headline)",
              fontWeight: 510,
              letterSpacing: "-0.012em",
            }}
          >
            RealEstaite
          </span>
        </Link>

        <nav
          className="hidden md:flex items-center gap-1"
          aria-label="Primary"
        >
          <Dropdown
            label="Product"
            open={productOpen}
            onOpenChange={setProductOpen}
            items={PRODUCT_LINKS}
          />
          <Dropdown
            label="Solutions"
            open={verticalOpen}
            onOpenChange={setVerticalOpen}
            items={VERTICAL_LINKS}
          />
          <NavLink href="/pricing" active={isActive(pathname, "/pricing")}>
            Pricing
          </NavLink>
          <Dropdown
            label="Compare"
            open={compareOpen}
            onOpenChange={setCompareOpen}
            items={[
              {
                href: "/compare/conversion-logix",
                label: "vs Conversion Logix",
                hint: "Same price, live dashboard",
              },
            ]}
          />
          <NavLink href="/blog" active={isActive(pathname, "/blog")}>
            Blog
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden md:inline-flex text-[13px] transition-colors px-3 py-1.5 rounded-md"
            style={{
              color: "var(--text-body)",
              fontWeight: 510,
            }}
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 text-[13px] px-3.5 py-1.5 rounded-md btn-accent"
            style={{ fontWeight: 510 }}
          >
            Book a demo
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 5h6m0 0L5.5 2.5M8 5L5.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </Link>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md"
            style={{
              border: "1px solid var(--border-standard)",
              color: "var(--text-body)",
            }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              {mobileOpen ? (
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              ) : (
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen ? <MobileMenu onClose={() => setMobileOpen(false)} /> : null}
    </header>
  );
}

function LogoMark() {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded"
      style={{
        backgroundColor: "var(--accent)",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.1) inset, 0 0 20px var(--accent-glow)",
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
      className="px-3 py-1.5 rounded-md text-[13px] transition-colors"
      style={{
        color: active ? "var(--text-headline)" : "var(--text-body)",
        fontWeight: 510,
        backgroundColor: active ? "var(--bg-chip)" : "transparent",
      }}
    >
      {children}
    </Link>
  );
}

function Dropdown({
  label,
  open,
  onOpenChange,
  items,
}: {
  label: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: Array<{ href: string; label: string; hint?: string }>;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
    >
      <button
        type="button"
        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] transition-colors"
        style={{
          color: "var(--text-body)",
          fontWeight: 510,
          backgroundColor: open ? "var(--bg-chip)" : "transparent",
        }}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        {label}
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open ? (
        <div className="absolute top-full left-0 pt-2 z-50">
          <ul
            className="p-1 w-[320px]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-standard)",
              borderRadius: "12px",
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-3 py-2.5 rounded-md transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <span
                    className="block text-[13px]"
                    style={{ color: "var(--text-headline)", fontWeight: 510 }}
                  >
                    {item.label}
                  </span>
                  {item.hint ? (
                    <span
                      className="block text-[12px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.hint}
                    </span>
                  ) : null}
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
    {
      title: "Product",
      items: PRODUCT_LINKS.map(({ href, label }) => ({ href, label })),
    },
    {
      title: "Solutions",
      items: VERTICAL_LINKS.map(({ href, label }) => ({ href, label })),
    },
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
        borderTop: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-panel)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-5">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="eyebrow mb-2">{s.title}</p>
            <ul className="space-y-1">
              {s.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    className="block px-2 py-2 rounded-md text-[14px]"
                    style={{
                      color: "var(--text-headline)",
                      fontWeight: 510,
                    }}
                    onClick={onClose}
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
