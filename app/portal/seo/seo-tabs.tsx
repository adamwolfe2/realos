"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// Sub-tab navigation rendered across every /portal/seo/* route.
//
// Mirrors Searchable.ai's pattern: a single primary nav item ("SEO") in
// the sidebar, with horizontal sub-tabs along the top of the section
// for switching between Overview / AI Search / Opportunities / etc.
//
// Active matching is exact-OR-prefix:
//   /portal/seo                   matches Overview EXACTLY (not prefix)
//   /portal/seo/aeo               matches AI Search via prefix
//   /portal/seo/aeo/anything      still matches AI Search via prefix
//   /portal/seo/recommendations   matches Opportunities via prefix
//
// Without the exact-match special-case for Overview, every nested page
// would also light up the Overview tab.
// ---------------------------------------------------------------------------

const TABS: Array<{ href: string; label: string; matchPrefix?: boolean }> = [
  { href: "/portal/seo", label: "Overview", matchPrefix: false },
  { href: "/portal/seo/aeo", label: "AI Search", matchPrefix: true },
  { href: "/portal/seo/recommendations", label: "Opportunities", matchPrefix: true },
  { href: "/portal/seo/agent", label: "Agent", matchPrefix: true },
  { href: "/portal/seo/neighborhoods", label: "Neighborhood pages", matchPrefix: true },
  { href: "/portal/seo/drafts", label: "Drafts", matchPrefix: true },
  { href: "/portal/seo/properties", label: "Properties", matchPrefix: true },
];

export function SeoTabs() {
  const pathname = usePathname();

  function isActive(tab: (typeof TABS)[number]): boolean {
    if (tab.matchPrefix) {
      return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    }
    return pathname === tab.href;
  }

  return (
    <nav
      aria-label="SEO sections"
      className="-mx-1 mb-6 border-b border-border overflow-x-auto"
    >
      <ul className="flex items-center gap-0.5 px-1 min-w-max">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex items-center h-9 px-3 text-[13px] font-medium",
                  "relative -mb-px transition-colors",
                  active
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
