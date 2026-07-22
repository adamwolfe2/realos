"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  MessageSquare,
  Fingerprint,
  Search,
  Star,
  TrendingUp,
  Target,
  Globe,
  Menu,
  X,
} from "lucide-react";

// Tesla-inspired: a transparent sticky nav that floats over the hero, turning
// to frosted white on scroll. Wordmark left, nav links centered, two utility
// links right. No shadow, no border. Single 14px weight-500 type system.

// Features dropdown — Norman brief (2026-05-28): "Core LeaseStack Platform"
// points to the all-features overview page; remaining items list the
// individual add-on modules in priority order.
//
// 2026-05-29 cleanup: Keyword Trends + Website Build used to share routes
// with adjacent items as placeholders. Now that dedicated sub-pages exist,
// every dropdown entry resolves to its own canonical page.
//
// 2026-05-29 rewrite: dropdown switched from a flat list to a 2-column
// card grid (Cursive-style) — each item carries an icon + a 1-line
// description so the dropdown reads as a discoverable menu of products
// instead of a list of labels.
type ProductLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const PRODUCT_LINKS: ProductLink[] = [
  {
    href: "/features",
    label: "Core LeaseStack Platform",
    description: "One dashboard instead of six vendor logins",
    icon: LayoutGrid,
  },
  {
    href: "/features/chatbot",
    label: "AI Chatbot",
    description: "Answers renters and books the tour at 2am",
    icon: MessageSquare,
  },
  {
    href: "/features/pixel",
    label: "Visitor Identification",
    description: "Puts a name and email on the traffic your forms miss",
    icon: Fingerprint,
  },
  {
    href: "/features/seo-aeo",
    label: "SEO / AEO",
    description: "Ranks on Google, gets cited when renters ask ChatGPT",
    icon: Search,
  },
  {
    // Reputation has no dedicated /features sub-page — it lives as a section
    // on the main features page. Deep-link there instead of /audit (the
    // lead-magnet quiz), which read as a broken menu link.
    href: "/features#reputation",
    label: "Reputation Management",
    description: "Every review and mention, one inbox, one-click reply",
    icon: Star,
  },
  {
    href: "/features/keyword-trends",
    label: "Keyword Trends",
    description: "See where you rank before a renter searches",
    icon: TrendingUp,
  },
  {
    href: "/features/ads",
    label: "Managed Ads",
    description: "Spend tied to signed leases, not impressions",
    icon: Target,
  },
  {
    href: "/features/website-build",
    label: "Website Build",
    description: "Live on your domain in 14 days",
    icon: Globe,
  },
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

  const labelColor = "#161616";
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
          borderRadius: scrolled ? 2 : 0,
          // Subtle ring + lifted shadow when floating; hairline bottom
          // border at top. Both interpolate through the same CSS prop
          // (boxShadow) so the morph reads as a single animation.
          boxShadow: scrolled
            ? "0 0 0 1px rgba(22, 22, 22, 0.06), 0 1px 2px rgba(22, 22, 22, 0.04)"
            : "inset 0 -1px 0 #e0e0e0",
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
            segments={VERTICAL_LINKS}
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
            <BookDemoLink
              className="inline-flex items-center justify-center"
              style={{
                minHeight: "36px",
                padding: "8px 16px",
                backgroundColor: "#0f62fe",
                color: "#f4f4f4",
                fontSize: "14px",
                fontWeight: 500,
                borderRadius: "2px",
                boxShadow: "0 0 0 1px #0f62fe inset",
                transition: "background-color 0.2s ease",
              }}
            >
              Book a demo
            </BookDemoLink>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-[2px]"
            style={{ color: labelColor, transition: "color 0.33s" }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? (
              <X size={20} strokeWidth={1.7} aria-hidden />
            ) : (
              <Menu size={20} strokeWidth={1.7} aria-hidden />
            )}
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
        borderRadius: "2px",
        color: "#161616",
        fontFamily: "var(--font-sans)",
        fontSize: "15px",
        fontWeight: 500,
        backgroundColor: active ? "#e0e0e0" : "transparent",
        transition: "background-color 0.2s ease",
      }}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Dropdown — Features menu as a 2-column card grid.
//
// Previous version (flat label list) read as 8 lines of text. The
// rewrite (2026-05-29) renders each link as a card with an icon box,
// title, and one-line description — Cursive-style — so the user can
// scan the product surface area instead of reading.
//
// Layout: 640px container, 2 columns × 4 rows, 20px gutter. Each card
// is the full <Link> target; the icon box, title, and description all
// sit inside that link, so the entire 44-line card area is clickable.
//
// Mobile fallback: this Dropdown only renders on md+. The MobileMenu
// below pulls from PRODUCT_LINKS too but only reads `label` + `href`,
// so the icon/description fields are no-ops there.
// ---------------------------------------------------------------------------
function Dropdown({
  label,
  open,
  btnClass,
  onOpenChange,
  items,
  segments,
  labelColor,
}: {
  label: string;
  btnClass: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: ProductLink[];
  segments: Array<{ href: string; label: string }>;
  labelColor: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  // Keyboard a11y: Escape closes and returns focus to the trigger; the panel
  // links are natively focusable/tabbable while open (punch-list item 3).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      onOpenChange(false);
      btnRef.current?.focus();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      onKeyDown={onKeyDown}
    >
      <button
        ref={btnRef}
        type="button"
        className={btnClass}
        style={{ color: labelColor }}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
      </button>
      {open ? (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50">
          <div
            className="p-4"
            role="menu"
            aria-label="Features"
            style={{
              backgroundColor: "#FFFFFF",
              boxShadow:
                "0 0 0 1px #e0e0e0, 0 4px 12px rgba(22, 22, 22, 0.08)",
              borderRadius: "2px",
              width: "min(680px, calc(100vw - 32px))",
            }}
          >
            <ul className="grid grid-cols-2 gap-1">
              {items.map((item) => (
                <li key={item.href} role="none">
                  <DropdownCard item={item} onSelect={() => onOpenChange(false)} />
                </li>
              ))}
            </ul>

            {/* Segments group — surfaces the vertical pages that were only in
                the mobile tree, reconciling desktop/mobile (item 3). */}
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid #e0e0e0" }}>
              <p
                className="px-3"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: "#5a647d",
                }}
              >
                Segments
              </p>
              <ul className="mt-1 grid grid-cols-2 gap-1">
                {segments.map((s) => (
                  <li key={s.href} role="none">
                    <Link
                      href={s.href}
                      role="menuitem"
                      onClick={() => onOpenChange(false)}
                      className="block rounded-[2px] px-3 py-2 transition-colors"
                      style={{
                        color: "#161616",
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f4f4f4";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// DropdownCard — single card in the Features grid. Hover lifts a soft
// gray wash behind the row so the cursor target stays visible even when
// the user is mid-flight between cards.
function DropdownCard({
  item,
  onSelect,
}: {
  item: ProductLink;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className="group flex items-start gap-3 rounded-[2px] px-3 py-3 transition-colors"
      style={{
        color: "#161616",
        fontFamily: "var(--font-sans)",
        backgroundColor: "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#f4f4f4";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 36,
          height: 36,
          borderRadius: 2,
          backgroundColor: "#f4f4f4",
          color: "#0f62fe",
        }}
      >
        <Icon size={18} strokeWidth={1.7} />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#161616",
            letterSpacing: "-0.005em",
            lineHeight: 1.3,
          }}
        >
          {item.label}
        </span>
        <span
          className="block mt-0.5"
          style={{
            fontSize: "12.5px",
            color: "#6f6f6f",
            fontWeight: 400,
            lineHeight: 1.4,
          }}
        >
          {item.description}
        </span>
      </span>
    </Link>
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
        style={{ backgroundColor: "#f4f4f4" }}
      >
        <style jsx>{`
          @keyframes menuSlideIn {
            0%   { opacity: 0; transform: translateY(-8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .menu-panel {
            animation: menuSlideIn 220ms ease-out both;
          }
          @keyframes linkPop {
            0%   { opacity: 0; transform: translateX(-6px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .menu-link {
            animation: linkPop 200ms ease-out both;
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
              style={{ backgroundColor: "#e0e0e0", color: "#161616" }}
              aria-label="Close menu"
            >
              <X size={18} strokeWidth={1.8} aria-hidden />
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
                  borderRadius: "2px",
                  color: "#161616",
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
            <BookDemoLink
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "52px",
                borderRadius: "2px",
                backgroundColor: "#0f62fe",
                color: "#f4f4f4",
                fontSize: "16px",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
              }}
            >
              Book a demo
            </BookDemoLink>
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
