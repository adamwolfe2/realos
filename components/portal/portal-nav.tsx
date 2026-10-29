"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  MessageSquare,
  Bot,
  BarChart3,
  Brush,
  CreditCard,
  Settings,
  Compass,
  TrendingUp,
  Bell,
  Gauge,
  Sparkles,
  FileText,
  Share2,
  Calendar,
  Star,
  ClipboardList,
  Wrench,
  Home,
  CalendarClock,
  PieChart,
  ShoppingBag,
  Plug,
  KeyRound,
  Globe,
  Lightbulb,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/portal/notification-bell";
import { CmdKSearch } from "@/components/portal/search/cmdk-search";
import { UserButton } from "@clerk/nextjs";
import { BRAND_NAME } from "@/lib/brand";
import {
  ActivePropertySwitcher,
  type ActivePropertyOption,
} from "@/components/portal/active-property-switcher";
import { BRAND_LOGOS } from "@/components/portal/integrations/brand-logos";

export type PortalNavOrg = {
  name: string;
  /** Integration slugs that are live or stale, shown as logos in the footer. */
  connectedSources?: string[];
  productLine?: string;
  moduleWebsite: boolean;
  moduleChatbot: boolean;
  moduleGoogleAds: boolean;
  moduleMetaAds: boolean;
  moduleCreativeStudio: boolean;
  moduleSEO: boolean;
  moduleReferrals: boolean;
  modulePopups: boolean;
  moduleVault: boolean;
  moduleReputation: boolean;
  moduleInsights: boolean;
  moduleAttribution: boolean;
  moduleResidents: boolean;
  moduleTours: boolean;
  moduleConversations: boolean;
  /**
   * Sidebar rows the operator has chosen to hide, by href. Cosmetic only —
   * entitlement lives on the module flags above. Lets an org drop a single
   * row of a module it still pays for (SG hides /portal/insights while
   * keeping /portal/reports; both ride moduleInsights).
   */
  navHiddenItems?: string[];
  bringYourOwnSite: boolean;
  onboardingDismissed: boolean;
  setupComplete: boolean;
  /** True when an AppFolio integration record exists — gates Operations nav group */
  appFolioConnected?: boolean;
  /**
   * White-label brand surface for the sidebar logo. When the white-label
   * add-on is active and the operator has uploaded their logo, the
   * sidebar wordmark + portal aria-labels swap from LeaseStack to the
   * operator's brand. Falls back to LeaseStack defaults when undefined
   * or `isWhiteLabeled` is false. See lib/brand/effective.ts.
   */
  brand?: {
    name: string;
    logoUrl: string | null;
    isWhiteLabeled: boolean;
  };
  /**
   * Soft-gating flags for Analytics-tier nav items. Hide pages that have
   * zero data (Briefing, Insights, Reports) so empty tabs don't bloat the
   * sidebar before the tenant has anything to look at. Set true once the
   * underlying tables have at least one row.
   */
  hasReports?: boolean;
  hasInsights?: boolean;
  hasCreativeRequests?: boolean;
  /**
   * True when the org has at least one lead AND one property — the
   * minimum corpus the briefing draws from. Hides Briefing on
   * brand-new tenants where the call sheet would be empty.
   */
  briefingHasContent?: boolean;
  /**
   * Tours come from the public booking form / API ingest, not AppFolio
   * (showings is a v1 CRUD entity, not a v2 report). Hide the nav until
   * a real tour exists.
   */
  hasTours?: boolean;
  /**
   * Applications can be logged manually (P1-9) in addition to demo
   * seeding. Hide until a row exists or AppFolio is connected.
   */
  hasApplications?: boolean;
  /**
   * Residents / work orders can be manually entered (P1-7/8), so their
   * nav items show when rows exist even without AppFolio.
   */
  hasResidents?: boolean;
  hasWorkOrders?: boolean;
  /**
   * Number of AppFolio records pending curation. Surfaces as a badge on
   * the Properties nav item so the signal is visible without eating a
   * full-width chrome banner on every page.
   */
  pendingCurationCount?: number;
  /**
   * Sidebar at-a-glance badge counts. Each surfaces as an inline pill on
   * its corresponding nav item when > 0 so operators see "what needs me"
   * without having to click into every page to check. All counts are
   * computed in app/portal/layout.tsx Promise.all with .catch(() => 0)
   * fallbacks so a missing field / schema drift degrades gracefully.
   */
  newLeadsTodayCount?: number;
  toursNext7dCount?: number;
  expiringLeases30dCount?: number;
  urgentWorkOrdersCount?: number;
  flaggedConversationsCount?: number;
  /** Billing is visible only to client owners or authorized agency support. */
  canManageBilling?: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (org: PortalNavOrg) => boolean;
  /** Optional inline count badge. Returns null/0 to hide. */
  badge?: (org: PortalNavOrg) => number | null;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * The one place SIDEBAR visibility is decided. Both the desktop sidebar and
 * the mobile drawer route through this, so a row can never appear in one and
 * not the other.
 *
 * NOT global: the Cmd+K palette searches its own static list
 * (components/portal/search/nav-registry.ts) and is filtered by neither
 * `navHiddenItems` NOR the module flags, so it can still surface a row this
 * function hides. Pre-existing and broader than nav preferences — see the
 * note on NAV_REGISTRY.
 *
 * Two independent gates, in order:
 *   1. `item.show(org)` — ENTITLEMENT + data. Module flags, soft-gates.
 *   2. `org.navHiddenItems` — the operator's cosmetic PREFERENCE.
 *
 * Keep them separate. `navHiddenItems` must never be consulted by
 * `requireModule` or billing: hiding a row is a sidebar opinion, not a
 * downgrade, and the page stays reachable by direct URL.
 */
export function visibleNavItems(
  group: NavGroup,
  org: PortalNavOrg,
): NavItem[] {
  const hidden = org.navHiddenItems;
  return group.items.filter(
    (item) => item.show(org) && !hidden?.includes(item.href),
  );
}

const ALWAYS = () => true;

// ---------------------------------------------------------------------------
// W2 nav consolidation (2026-05-28):
//   Collapsed 7 sidebar groups → 4 (Today, Pipeline, Marketing, Account)
//   per the integration-hub + portal-nav consolidation effort.
//
//   - Today    : dashboard, briefing, notifications
//   - Pipeline : every surface that moves a prospect through the funnel
//                (leads, tours, applications, residents,
//                 work-orders, renewals, conversations)
//   - Marketing: every outbound + content surface (ads, campaigns,
//                creative, chatbot, popups, content, SEO, attribution,
//                reputation, referrals, reports, insights,
//                Site Engine)
//   - Account  : everything an operator manages (properties, settings,
//                billing, integrations hub, marketplace, vault)
//
//   Setup / Connect / Marketplace / Vault / Settings integrations are
//   funneled into the new canonical hub at /portal/integrations.
// ---------------------------------------------------------------------------
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Agent",
    items: [
      { href: "/portal", label: "Overview", icon: LayoutDashboard, show: ALWAYS },
      {
        href: "/portal/chatbot",
        label: "Chatbot",
        icon: Bot,
        show: (o) => o.moduleChatbot,
      },
      {
        href: "/portal/conversations",
        label: "Conversations",
        icon: MessageSquare,
        show: (o) => o.moduleConversations,
        badge: (o) => o.flaggedConversationsCount ?? null,
      },
      {
        href: "/portal/conversations/insights",
        label: "Suggested fixes",
        icon: Lightbulb,
        show: (o) => o.moduleConversations,
      },
      // Norman 2026-06-04: Briefing tab hidden from sidebar until lead
      // inbox routing is configured. The page still exists at
      // /portal/briefing for deep links + when an operator wires up the
      // weekly call-sheet. Re-enable by restoring the original
      // `moduleInsights && briefingHasContent` predicate.
      {
        href: "/portal/briefing",
        label: "Briefing",
        icon: Gauge,
        show: () => false,
      },
      // Norman 2026-06-04: Notifications tab hidden from sidebar until
      // we filter out passive-property + lease-expiry noise (Norman saw
      // 62 unread, most for deactivated properties). The bell in the
      // top header still shows live notifications — this just removes
      // the redundant sidebar entry. Re-enable with `show: ALWAYS`
      // once the notification filtering rules ship.
      {
        href: "/portal/notifications",
        label: "Notifications",
        icon: Bell,
        show: () => false,
      },
    ],
  },
  {
    label: "Portfolio",
    items: [
      // Properties surfaces above the lead pipeline because operators
      // think building-first: portfolio status drives which leads matter.
      {
        href: "/portal/properties",
        label: "Properties",
        icon: Building2,
        show: ALWAYS,
        badge: () => null,
      },
      {
        href: "/portal/leads",
        label: "Leads",
        icon: Users,
        show: ALWAYS,
        badge: (o) => o.newLeadsTodayCount ?? null,
      },
      {
        href: "/portal/tours",
        label: "Tours",
        icon: Calendar,
        show: (o) => o.moduleTours && Boolean(o.hasTours),
        badge: (o) => o.toursNext7dCount ?? null,
      },
      {
        href: "/portal/applications",
        label: "Applications",
        icon: ClipboardList,
        show: (o) =>
          o.moduleResidents &&
          (Boolean(o.appFolioConnected) || Boolean(o.hasApplications)),
      },
      {
        href: "/portal/residents",
        label: "Residents",
        icon: Home,
        show: (o) =>
          o.moduleResidents &&
          (Boolean(o.appFolioConnected) || Boolean(o.hasResidents)),
      },
      {
        href: "/portal/renewals",
        label: "Renewals",
        icon: CalendarClock,
        show: (o) => o.moduleResidents && Boolean(o.appFolioConnected),
        badge: (o) => o.expiringLeases30dCount ?? null,
      },
      {
        href: "/portal/work-orders",
        label: "Work orders",
        icon: Wrench,
        show: (o) =>
          o.moduleResidents &&
          (Boolean(o.appFolioConnected) || Boolean(o.hasWorkOrders)),
        badge: (o) => o.urgentWorkOrdersCount ?? null,
      },
    ],
  },
  {
    label: "Learns from",
    items: [
      { href: "/portal/connect", label: "Data sources", icon: Plug, show: ALWAYS },
      {
        href: "/portal/ads",
        label: "Ads",
        icon: BarChart3,
        show: (o) => o.moduleGoogleAds || o.moduleMetaAds,
      },
      {
        href: "/portal/seo",
        label: "SEO",
        icon: TrendingUp,
        show: (o) => o.moduleSEO,
      },
      // Content drafter — every plan can open it; the quota meter on the
      // page (and the API enforcement) decides whether they can actually
      // generate.
      { href: "/portal/content", label: "Content", icon: FileText, show: ALWAYS },
      {
        href: "/portal/reputation",
        label: "Reputation",
        icon: Star,
        show: (o) => o.moduleReputation,
      },
      // Site Engine — only when the org's site is OURS to manage. An org
      // that brought its own site has no use for this surface (Adam,
      // 2026-07-29: nav shows only what the org actually uses).
      {
        href: "/portal/sites/request",
        label: "Site Engine",
        icon: Globe,
        show: (o) => o.moduleWebsite && !o.bringYourOwnSite,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/portal/performance", label: "Performance", icon: Activity, show: ALWAYS },
      {
        href: "/portal/attribution",
        label: "Attribution",
        icon: PieChart,
        show: (o) => o.moduleAttribution,
      },
      {
        href: "/portal/insights",
        label: "Insights",
        icon: Sparkles,
        show: (o) => o.moduleInsights && Boolean(o.hasInsights),
      },
      {
        href: "/portal/reports",
        label: "Reports",
        icon: FileText,
        show: (o) => o.moduleInsights && Boolean(o.hasReports),
      },
      {
        href: "/portal/creative",
        label: "Creative",
        icon: Brush,
        show: (o) =>
          o.moduleCreativeStudio && Boolean(o.hasCreativeRequests),
      },
      {
        href: "/portal/popups",
        label: "Popups",
        icon: Sparkles,
        show: (o) => o.modulePopups,
      },
      {
        href: "/portal/referrals",
        label: "Referrals",
        icon: Share2,
        show: (o) => o.moduleReferrals,
      },
    ],
  },
  {
    label: "Account",
    items: [
      // Evaluator (acquisitions tool) removed from client nav 2026-07-29
      // (Adam): no module flag exists for it and no client org uses it.
      // The page stays reachable at /portal/tools/value.
      {
        href: "/portal/integrations",
        label: "Integrations",
        icon: Plug,
        show: ALWAYS,
      },
      {
        href: "/portal/marketplace",
        label: "Marketplace",
        icon: ShoppingBag,
        show: ALWAYS,
      },
      {
        href: "/portal/vault",
        label: "Vault",
        icon: KeyRound,
        show: (o) => o.moduleVault,
      },
      {
        href: "/portal/billing",
        label: "Billing",
        icon: CreditCard,
        show: (o) => o.canManageBilling === true,
      },
      { href: "/portal/settings", label: "Settings", icon: Settings, show: ALWAYS },
      // Setup — kept as a deep link for operators still mid-onboarding,
      // but folded into Account since the steps are mostly integration
      // wiring + property setup.
      {
        href: "/portal/setup",
        label: "Setup",
        icon: Compass,
        show: (o) => !o.setupComplete && !o.onboardingDismissed,
      },
    ],
  },
];

// Rail icon per group. Keyed by label so NavGroup stays a plain data shape
// shared with the mobile drawer and tests.
const GROUP_ICONS: Record<string, LucideIcon> = {
  Agent: Bot,
  Portfolio: Building2,
  "Learns from": Plug,
  Reports: Activity,
  Account: Settings,
};

function isActiveHref(pathname: string | null, href: string): boolean {
  return pathname === href || (href !== "/portal" && Boolean(pathname?.startsWith(href)));
}

export function PortalNav({
  org,
  scopeProperties = [],
  activePropertyId = null,
}: {
  org: PortalNavOrg;
  /** Properties the current user can scope to. Empty/1-length list hides
      the switcher entirely. Falls back to [] for backwards-compat. */
  scopeProperties?: ActivePropertyOption[];
  /** Currently-selected property id from the portal_active_property_id
      cookie. null = All properties. */
  activePropertyId?: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("portal-sidebar-collapsed");
      if (stored) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("portal-sidebar-collapsed", String(next));
    } catch {
      // ignore
    }
  }

  // Intercom-style shell: a slim icon rail picks the section, a sub-nav
  // lists that section's pages. The active section is whichever group owns
  // the longest href matching the current path.
  const groups = NAV_GROUPS.map((group) => ({ ...group, visible: visibleNavItems(group, org) })).filter(
    (g) => g.visible.length > 0,
  );
  let activeGroup = groups[0];
  let bestLen = -1;
  for (const g of groups) {
    for (const item of g.visible) {
      if (isActiveHref(pathname, item.href) && item.href.length > bestLen) {
        activeGroup = g;
        bestLen = item.href.length;
      }
    }
  }
  const activeItemHref = activeGroup?.visible
    .filter((i) => isActiveHref(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="hidden lg:flex shrink-0">
      {/* Rail */}
      <aside className="ls-rail flex w-[60px] flex-col items-center py-3 gap-1" aria-label="Sections">
        <Link
          href="/portal"
          className="mb-3 grid h-9 w-9 place-items-center"
          aria-label={`${org.brand?.name ?? BRAND_NAME} portal home`}
        >
          {org.brand?.isWhiteLabeled ? (
            <span className="grid h-8 w-8 place-items-center rounded-[10px] text-[13px] font-semibold bg-foreground text-background" aria-hidden>
              {(org.brand.name[0] ?? "?").toUpperCase()}
            </span>
          ) : (
            <Image src="/favicon.svg" alt={BRAND_NAME} width={28} height={28} className="h-7 w-7" unoptimized priority />
          )}
        </Link>
        {groups.map((g) => {
          const Icon = GROUP_ICONS[g.label] ?? LayoutDashboard;
          const active = g === activeGroup;
          return (
            <Link
              key={g.label}
              href={g.visible[0].href}
              title={g.label}
              aria-current={active ? "true" : undefined}
              className={cn("ls-rail-item", active && "is-active")}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="sr-only">{g.label}</span>
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1">
          <NotificationBell />
          <div className="my-1 grid h-9 w-9 place-items-center">
            <UserButton />
          </div>
          {/* Keeps the Cmd+K listener mounted when the sub-nav is hidden;
              the trigger is clipped, the fixed-position palette is not. */}
          {collapsed ? (
            <div className="h-0 w-0 overflow-hidden">
              <CmdKSearch />
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="ls-rail-item"
            aria-label={collapsed ? "Show section menu" : "Hide section menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Sub-nav */}
      {!collapsed && activeGroup ? (
        <aside className="ls-subnav flex w-[232px] flex-col" aria-label="Portal navigation">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[12px] text-[var(--t-muted)] truncate">{org.name}</p>
            <h2 className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-[var(--t-ink)]">
              {activeGroup.label}
            </h2>
          </div>
          <div className="px-3 pb-2 [&>button]:!flex [&>button]:w-full [&>button]:rounded-[8px] [&>button]:py-2 [&_kbd]:ml-auto">
            <CmdKSearch />
          </div>
          {scopeProperties.length > 1 ? (
            <div className="px-3 pb-2">
              <ActivePropertySwitcher properties={scopeProperties} activePropertyId={activePropertyId} collapsed={false} />
            </div>
          ) : null}
          <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-[1px]">
            {activeGroup.visible.map((item) => {
              const count = item.badge?.(org);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("ls-sidebar-item", item.href === activeItemHref && "is-active")}
                >
                  <item.icon className="h-[15px] w-[15px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count ? (
                    <span className="ls-count" aria-label={`${count} pending`}>
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          {org.connectedSources?.length ? (
            <div className="px-4 py-3">
              <p className="text-[12px] text-[var(--t-muted)]">Learning from</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {org.connectedSources.map((slug) => {
                  const logo = BRAND_LOGOS[slug];
                  if (!logo) return null;
                  return (
                    <Link key={slug} href="/portal/connect" title={slug} className="grid h-7 w-7 place-items-center rounded-[8px] bg-white ring-1 ring-[var(--t-border)]">
                      <span className="h-3.5 w-3.5 [&_svg]:h-full [&_svg]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-contain" style={{ color: logo.brandColor, fill: logo.brandColor }}>{logo.render()}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
