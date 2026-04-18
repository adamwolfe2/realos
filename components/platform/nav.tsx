"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BRAND_NAME } from "@/lib/brand";

const PRODUCT_LINKS = [
  { href: "/features/pixel", label: "Identity pixel", hint: "Name your anonymous traffic" },
  { href: "/features/chatbot", label: "AI chatbot", hint: "Captures leads at 2 a.m." },
  { href: "/features/seo-aeo", label: "SEO and AEO", hint: "Google and ChatGPT, both" },
  { href: "/features/ads", label: "Managed ads", hint: "Creative in 48 hours" },
];

const VERTICAL_LINKS = [
  { href: "/student-housing", label: "Student housing", hint: "Sprint pricing, turn-heavy calendar" },
  { href: "/multifamily", label: "Multifamily", hint: "Portfolio rollups + fair housing" },
  { href: "/senior-living", label: "Senior living", hint: "Family-first, patient nurture" },
  { href: "/commercial", label: "Commercial", hint: "Coming Q3" },
];

export function PlatformNav() {
  const pathname = usePathname();
  const [productOpen, setProductOpen] = useState(false);
  const [verticalOpen, setVerticalOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur"
      style={{
        backgroundColor: "rgba(249, 247, 244, 0.9)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-serif font-bold text-lg"
          style={{ color: "var(--text-headline)" }}
        >
          {BRAND_NAME}
        </Link>
        <nav
          className="hidden md:flex items-center gap-6 text-sm"
          style={{ color: "var(--text-body)" }}
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
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="font-mono text-xs font-semibold px-4 py-2 rounded"
            style={{
              backgroundColor: "var(--blue)",
              color: "white",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Book a demo
          </Link>
        </div>
      </div>
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
      className="transition-colors"
      style={{
        color: active ? "var(--text-headline)" : "var(--text-body)",
        fontWeight: active ? 600 : 500,
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
        className="flex items-center gap-1 transition-colors"
        style={{ color: "var(--text-body)" }}
        onClick={() => onOpenChange(!open)}
      >
        {label}
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{ opacity: 0.6 }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open ? (
        <div className="absolute top-full right-0 pt-3 z-50">
          <ul
            className="py-2 w-72 bg-white shadow-xl"
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "10px",
            }}
          >
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-4 py-3 transition-colors"
                  style={{ color: "var(--text-body)" }}
                >
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: "var(--text-headline)" }}
                  >
                    {item.label}
                  </span>
                  {item.hint ? (
                    <span
                      className="block font-mono text-[11px] mt-0.5"
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

function isActive(pathname: string | null, prefix: string): boolean {
  return (
    pathname === prefix ||
    (prefix !== "/" && (pathname ?? "").startsWith(prefix))
  );
}
