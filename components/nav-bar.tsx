"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function SailLogo({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M16 2L16 28L6 28C6 28 14 16 16 2Z" fill="var(--blue)" opacity="0.9" />
      <path d="M18 8L18 28L26 28C26 28 20 18 18 8Z" fill="var(--blue)" opacity="0.55" />
      <path d="M4 29L28 29" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

interface NavItem {
  label: string;
  href: string;
  desc?: string;
}

const ALL_INDUSTRIES: NavItem[] = [
  { label: "Food & Beverage",       href: "/food-beverage",       desc: "Specialty foods, produce, dairy" },
  { label: "Wine & Spirits",        href: "/wine-spirits",         desc: "Importers and distributors" },
  { label: "Industrial Supply",     href: "/industrial-supply",    desc: "MRO and safety equipment" },
  { label: "Coffee & Tea",          href: "/coffee-tea",           desc: "Roasters and importers" },
  { label: "Seafood & Meat",        href: "/seafood-meat",         desc: "Protein and perishables" },
  { label: "Bakery Distribution",   href: "/bakery-distribution",  desc: "Artisan and baked goods" },
  { label: "Floral & Nursery",      href: "/floral-nursery",       desc: "Wholesale floral and plants" },
  { label: "Produce & Dairy",       href: "/produce-dairy",        desc: "Fresh perishables" },
  { label: "Specialty Food",        href: "/specialty-food",       desc: "Artisan and gourmet imports" },
  { label: "Beauty & Cosmetics",    href: "/beauty-cosmetics",     desc: "Salon and pro supply" },
  { label: "Pet Supply",            href: "/pet-supply",           desc: "Pet stores and groomers" },
  { label: "Jan-San",               href: "/jan-san",              desc: "Janitorial and sanitation" },
  { label: "Building Materials",    href: "/building-materials",   desc: "Contractors and lumber yards" },
  { label: "Agricultural Supply",   href: "/agricultural-supply",  desc: "Seed, feed, and ag inputs" },
  { label: "Apparel & Fashion",     href: "/apparel-fashion",      desc: "Clothing wholesale" },
  { label: "Auto Parts",            href: "/auto-parts",           desc: "Aftermarket and OEM" },
  { label: "Chemical Supply",       href: "/chemical-supply",      desc: "Industrial chemicals" },
  { label: "Supplements",           href: "/supplements",          desc: "Nutraceuticals and health" },
  { label: "Electrical Supply",     href: "/electrical-supply",    desc: "Contractors and commercial" },
  { label: "Tobacco & Vape",        href: "/tobacco-vape",         desc: "C-store and smoke shops" },
  { label: "Restaurant Equipment",  href: "/restaurant-equipment", desc: "Commercial kitchen supply" },
  { label: "Packaging Supply",      href: "/packaging-supply",     desc: "Corrugated and industrial" },
  { label: "Plumbing & HVAC",       href: "/plumbing-hvac",        desc: "Contractors and supply houses" },
  { label: "Office & Breakroom",    href: "/office-breakroom",     desc: "Facilities consumables" },
  { label: "Craft & Art Supply",    href: "/craft-art-supply",     desc: "Independent retailers" },
  { label: "Jewelry & Accessories", href: "/jewelry-accessories",  desc: "Boutiques and specialty retail" },
];

const MORE_ITEMS: NavItem[] = [
  { label: "What Is AI-ified?",        href: "/ai-ified",                                         desc: "AI automation for distributors" },
  { label: "Press",                    href: "/press",                                             desc: "Coverage and news" },
  { label: "Shopify B2B vs Wholesail", href: "/blog/shopify-b2b-vs-custom-wholesale-portal",      desc: "Feature comparison" },
  { label: "Wholesail vs NetSuite",    href: "/blog/wholesail-vs-netsuite-for-distributors",       desc: "ERP alternative" },
  { label: "vs HubSpot / Salesforce",  href: "/blog/hubspot-salesforce-distribution-alternatives", desc: "CRM alternative" },
  { label: "vs Handshake / Faire",     href: "/blog/handshake-faire-vs-custom-wholesale-portal",  desc: "Marketplace alternative" },
];

/** Shared floating card-grid dropdown used by both Industries and More */
function CardGridButton({
  label,
  items,
  cols,
  width,
  eyebrow,
}: {
  label: string;
  items: NavItem[];
  cols: number;
  width: number;
  eyebrow?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="font-mono text-[13px] flex items-center gap-1 cursor-pointer link-body"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        {label}
        <ChevronDown
          className="w-3 h-3"
          style={{
            transition: "transform 180ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Centering wrapper */}
      <div style={{ position: "absolute", left: "50%", top: "calc(100% + 10px)", zIndex: 50 }}>
        {/* Animated panel */}
        <div
          style={{
            width: `${width}px`,
            transform: open
              ? "translateX(-50%) translateY(0)"
              : "translateX(-50%) translateY(-6px)",
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transition: "opacity 160ms ease, transform 160ms ease",
            border: "1px solid var(--border-strong)",
            backgroundColor: "var(--bg-white)",
            borderRadius: "10px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)",
            padding: "20px 20px 16px",
          }}
        >
          {eyebrow && (
            <div
              className="font-mono text-[9px] uppercase tracking-widest mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              {eyebrow}
            </div>
          )}

          <div
            className="grid gap-1.5"
            role="menu"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-md"
                style={{
                  textDecoration: "none",
                  padding: "9px 11px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-primary)",
                  transition: "border-color 120ms ease, background-color 120ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-white)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-primary)";
                }}
              >
                <div
                  className="font-mono text-[11px] font-semibold leading-snug"
                  style={{ color: "var(--text-headline)" }}
                >
                  {item.label}
                </div>
                {item.desc && (
                  <div
                    className="font-mono text-[9px] leading-snug mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.desc}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Nav link with animated underline on active */
function ActiveNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href.split("#")[0]));

  return (
    <Link href={href} className="font-mono text-[13px] link-body relative inline-block">
      {children}
      {isActive && (
        <motion.span
          layoutId="nav-underline"
          className="absolute bottom-[-3px] left-0 right-0 h-[2px]"
          style={{ backgroundColor: "var(--blue)" }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </Link>
  );
}

/** Flat list of nav items for the mobile sheet */
const MOBILE_NAV_LINKS: NavItem[] = [
  { label: "Platform",  href: "/#demo" },
  { label: "Pricing",   href: "/#pricing" },
  { label: "Blog",      href: "/blog" },
  { label: "About",     href: "/about" },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{ backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
          <SailLogo className="w-5 h-5" />
          <span className="font-serif text-lg font-bold tracking-[0.05em]" style={{ color: "var(--text-headline)" }}>
            WHOLESAIL
          </span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden md:flex items-center gap-5">
          <ActiveNavLink href="/#demo">Platform</ActiveNavLink>
          <ActiveNavLink href="/#pricing">Pricing</ActiveNavLink>
          <CardGridButton
            label="Industries"
            items={ALL_INDUSTRIES}
            cols={4}
            width={760}
            eyebrow="All Industries"
          />
          <ActiveNavLink href="/blog">Blog</ActiveNavLink>
          <ActiveNavLink href="/about">About</ActiveNavLink>
          <CardGridButton
            label="More"
            items={MORE_ITEMS}
            cols={3}
            width={480}
            eyebrow="Resources & Comparisons"
          />
        </div>

        {/* Right side: CTA + mobile hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/#intake-form"
            className="font-mono text-[13px] font-semibold btn-blue"
            style={{ padding: "9px 20px", borderRadius: "6px" }}
          >
            Get Started
          </Link>

          {/* Mobile hamburger — only visible below md */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden flex items-center justify-center w-9 h-9"
                aria-label="Open navigation menu"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-headline)" }}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72 p-0" style={{ backgroundColor: "var(--bg-primary)" }} aria-describedby={undefined}>
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              {/* Sheet header */}
              <div
                className="flex items-center gap-2 px-5 py-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <SailLogo className="w-4 h-4" />
                <span className="font-serif text-base font-bold tracking-[0.05em]" style={{ color: "var(--text-headline)" }}>
                  WHOLESAIL
                </span>
              </div>

              {/* Mobile nav links */}
              <nav className="flex flex-col px-3 py-3">
                {MOBILE_NAV_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-mono text-[13px] link-body flex items-center min-h-[48px] px-3"
                    style={{ textDecoration: "none", borderBottom: "1px solid var(--border)" }}
                  >
                    {item.label}
                  </Link>
                ))}

                {/* Industries group heading */}
                <div
                  className="font-mono text-[9px] uppercase tracking-widest px-3 pt-4 pb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Industries
                </div>
                {ALL_INDUSTRIES.slice(0, 8).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-mono text-[12px] link-body flex items-center min-h-[44px] px-3"
                    style={{ textDecoration: "none", borderBottom: "1px solid var(--border)" }}
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    // Show remaining industries by expanding — for now scroll to top where mega menu lives
                  }}
                  className="font-mono text-[11px] flex items-center min-h-[44px] px-3 cursor-pointer"
                  style={{ background: "none", border: "none", textAlign: "left", color: "var(--blue)", padding: "0 12px" }}
                >
                  +{ALL_INDUSTRIES.length - 8} more industries
                </button>

                {/* Resources group heading */}
                <div
                  className="font-mono text-[9px] uppercase tracking-widest px-3 pt-4 pb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Resources
                </div>
                {MORE_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-mono text-[12px] link-body flex items-center min-h-[44px] px-3"
                    style={{ textDecoration: "none", borderBottom: "1px solid var(--border)" }}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Sheet CTA */}
              <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
                <Link
                  href="/#intake-form"
                  onClick={() => setMobileOpen(false)}
                  className="font-mono text-[13px] font-semibold btn-blue flex items-center justify-center w-full min-h-[48px]"
                  style={{ borderRadius: "6px", textDecoration: "none" }}
                >
                  Get Started
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
