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
  Eye,
  MessageSquare,
  Bot,
  Megaphone,
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
  Target,
  Send,
  History,
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
  Calculator,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/portal/notification-bell";
import { BRAND_NAME } from "@/lib/brand";
import {
  ActivePropertySwitcher,
  type ActivePropertyOption,
} from "@/components/portal/active-property-switcher";

export type PortalNavOrg = {
  name: string;
  productLine?: string;
  moduleWebsite: boolean;
  modulePixel: boolean;
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
  bringYourOwnSite: boolean;
  onboardingDismissed: boolean;
  setupComplete: boolean;
  isAudienceSync?: boolean;
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
   * Applications have no production write path yet — the page is empty
   * for every real tenant. Hide until either AppFolio rental_application
   * sync ships or a public application form is wired.
   */
  hasApplications?: boolean;
  /**
   * Number of AppFolio records pending curation. Surfaces as a badge on
   * the Properties nav item so the signal is visible without eating a
   * full-width chrome banner on every page.
   */
  pendingCurationCount?: number;
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

const ALWAYS = () => true;
const NEVER = () => false;

// Audience Sync product line nav. Shown when org.isAudienceSync is true
// (or AL_PARTNER user without an impersonation target). Replaces the full
// student-housing nav with a focused four-section dashboard.
export const AUDIENCE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Audiences",
    items: [
      { href: "/portal/audiences", label: "Segments", icon: Target, show: ALWAYS },
      { href: "/portal/audiences/destinations", label: "Destinations", icon: Send, show: ALWAYS },
      { href: "/portal/audiences/schedules", label: "Schedules", icon: Calendar, show: ALWAYS },
      { href: "/portal/audiences/history", label: "Sync history", icon: History, show: ALWAYS },
      { href: "/portal/audiences/settings", label: "Settings", icon: Settings, show: ALWAYS },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/portal/notifications", label: "Notifications", icon: Bell, show: ALWAYS },
      { href: "/portal/billing", label: "Billing", icon: CreditCard, show: ALWAYS },
      { href: "/portal/settings", label: "Settings", icon: Settings, show: ALWAYS },
    ],
  },
];

// ---------------------------------------------------------------------------
// W2 nav consolidation (2026-05-28):
//   Collapsed 7 sidebar groups → 4 (Today, Pipeline, Marketing, Account)
//   per the integration-hub + portal-nav consolidation effort.
//
//   - Today    : dashboard, briefing, notifications
//   - Pipeline : every surface that moves a prospect through the funnel
//                (leads, visitors, tours, applications, residents,
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
    label: "Today",
    items: [
      { href: "/portal", label: "Dashboard", icon: LayoutDashboard, show: ALWAYS },
      {
        href: "/portal/briefing",
        label: "Briefing",
        icon: Gauge,
        show: (o) => o.moduleInsights && Boolean(o.briefingHasContent),
      },
      {
        href: "/portal/notifications",
        label: "Notifications",
        icon: Bell,
        show: ALWAYS,
      },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/portal/leads", label: "Leads", icon: Users, show: ALWAYS },
      {
        href: "/portal/visitors",
        label: "Visitors",
        icon: Eye,
        show: (o) => o.modulePixel,
      },
      {
        href: "/portal/tours",
        label: "Tours",
        icon: Calendar,
        show: (o) => o.moduleTours && Boolean(o.hasTours),
      },
      {
        href: "/portal/applications",
        label: "Applications",
        icon: ClipboardList,
        show: (o) => o.moduleResidents && Boolean(o.hasApplications),
      },
      {
        href: "/portal/residents",
        label: "Residents",
        icon: Home,
        show: (o) => o.moduleResidents && Boolean(o.appFolioConnected),
      },
      {
        href: "/portal/renewals",
        label: "Renewals",
        icon: CalendarClock,
        show: (o) => o.moduleResidents && Boolean(o.appFolioConnected),
      },
      {
        href: "/portal/work-orders",
        label: "Work orders",
        icon: Wrench,
        show: (o) => o.moduleResidents && Boolean(o.appFolioConnected),
      },
      {
        href: "/portal/conversations",
        label: "Conversations",
        icon: MessageSquare,
        show: (o) => o.moduleConversations,
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        href: "/portal/campaigns",
        label: "Campaigns",
        icon: Megaphone,
        show: (o) => o.moduleGoogleAds || o.moduleMetaAds,
      },
      {
        href: "/portal/ads",
        label: "Ads",
        icon: BarChart3,
        show: (o) => o.moduleGoogleAds || o.moduleMetaAds,
      },
      {
        href: "/portal/creative",
        label: "Creative",
        icon: Brush,
        show: (o) =>
          o.moduleCreativeStudio && Boolean(o.hasCreativeRequests),
      },
      {
        href: "/portal/chatbot",
        label: "Chatbot",
        icon: Bot,
        show: (o) => o.moduleChatbot,
      },
      {
        href: "/portal/popups",
        label: "Popups",
        icon: Sparkles,
        show: (o) => o.modulePopups,
      },
      // Content drafter — every plan can open it; the quota meter on the
      // page (and the API enforcement) decides whether they can actually
      // generate.
      { href: "/portal/content", label: "Content", icon: FileText, show: ALWAYS },
      {
        href: "/portal/seo",
        label: "SEO",
        icon: TrendingUp,
        show: (o) => o.moduleSEO,
      },
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
        href: "/portal/reputation",
        label: "Reputation",
        icon: Star,
        show: (o) => o.moduleReputation,
      },
      {
        href: "/portal/referrals",
        label: "Referrals",
        icon: Share2,
        show: (o) => o.moduleReferrals,
      },
      // Site Engine — canonical user-facing label for the managed
      // marketing-site workflow (TASK D consolidation).
      {
        href: "/portal/sites/request",
        label: "Site Engine",
        icon: Globe,
        show: ALWAYS,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/portal/properties",
        label: "Properties",
        icon: Building2,
        show: ALWAYS,
        badge: () => null,
      },
      // Acquisitions tool — paste an address, get cap rate / cash-on-cash
      // / comps via RentCast. Lives under Account because it's about
      // evaluating buildings the operator might add to their portfolio,
      // not about the existing pipeline.
      {
        href: "/portal/tools/value",
        label: "Evaluator",
        icon: Calculator,
        show: ALWAYS,
      },
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
      { href: "/portal/billing", label: "Billing", icon: CreditCard, show: ALWAYS },
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

// Silence the "unused" warning for the NEVER helper retained for callers.
void NEVER;

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("portal-sidebar-collapsed");
      if (stored) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
    setMounted(true);
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

  return (
    <aside
      className={cn(
        "ls-sidebar relative hidden md:flex flex-col transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Brand. White-label-aware: when the operator has the add-on active
          and uploaded a logo, the sidebar wordmark renders THEIR brand.
          Collapsed mode falls back to the brand initial (or LeaseStack
          icon) because we don't have a square favicon for every tenant. */}
      <div className="flex h-14 items-center px-4 border-b border-border">
        <Link
          href="/portal"
          className="flex items-center min-w-0"
          aria-label={`${org.brand?.name ?? BRAND_NAME} portal home`}
        >
          {collapsed ? (
            org.brand?.isWhiteLabeled ? (
              // No square favicon for white-labeled tenants yet — render
              // the brand initial in a chip. Custom favicon support is a
              // follow-up product call (see report-back notes).
              <span
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded text-[12px] font-semibold bg-foreground text-background"
                aria-hidden
              >
                {(org.brand.name[0] ?? "?").toUpperCase()}
              </span>
            ) : (
              // Norman 2026-05-21: was /icon-32x32.png — an older raster
              // mark that doesn't match the current wordmark. Swapped to
              // the canonical /favicon.svg so the collapsed mark and the
              // expanded wordmark read as the same brand identity.
              <Image
                src="/favicon.svg"
                alt={BRAND_NAME}
                width={28}
                height={28}
                className="w-7 h-7 shrink-0"
                unoptimized
                priority
              />
            )
          ) : org.brand?.isWhiteLabeled && org.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.brand.logoUrl}
              alt={org.brand.name}
              className="h-8 w-auto max-w-[140px] object-contain shrink-0"
            />
          ) : org.brand?.isWhiteLabeled ? (
            // White-label on but logo missing — render text wordmark so
            // the chrome reads as a real product instead of empty space.
            <span className="text-[15px] font-semibold tracking-tight truncate max-w-[160px]">
              {org.brand.name}
            </span>
          ) : (
            <Image
              src="/logos/leasestack-wordmark.png"
              alt={BRAND_NAME}
              width={140}
              height={32}
              className="h-8 w-auto shrink-0"
              priority
            />
          )}
        </Link>
      </div>

      {/* Org name */}
      {!collapsed && (
        <div className="px-4 py-2.5 border-b border-border">
          <p className="text-xs font-medium text-foreground truncate">{org.name}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            Portal
          </p>
        </div>
      )}

      {/* Per-property scope switcher. Renders nothing for single-property
          operators; for multi-property accounts it lets the user scope
          every property-aware page to one building via a cookie. */}
      {scopeProperties.length > 1 ? (
        <div className={cn("border-b border-border", collapsed ? "px-1.5 py-2" : "px-3 py-2.5") }>
          <ActivePropertySwitcher
            properties={scopeProperties}
            activePropertyId={activePropertyId}
            collapsed={collapsed}
          />
        </div>
      ) : null}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Portal navigation">
        {(org.isAudienceSync ? AUDIENCE_NAV_GROUPS : NAV_GROUPS).map((group) => {
          const visible = group.items.filter((item) => item.show(org));
          if (!visible.length) return null;
          return (
            <div key={group.label} className="mb-3">
              {!collapsed && (
                <div className="ls-sidebar-section-label">{group.label}</div>
              )}
              <div className="px-2 space-y-[2px]">
                {visible.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/portal" && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "ls-sidebar-item",
                        active && "is-active",
                        collapsed && "justify-center"
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {(() => {
                            const count = item.badge?.(org);
                            if (!count) return null;
                            return (
                              <span
                                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold tabular-nums"
                                style={{
                                  background: "var(--brand-soft)",
                                  color: "var(--terracotta)",
                                }}
                                aria-label={`${count} pending`}
                              >
                                {count > 99 ? "99+" : count}
                              </span>
                            );
                          })()}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleCollapsed}
        className="absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted transition-colors z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* Footer — Norman 2026-05-21: UserButton moved out to the
          top-right topbar next to the notification bell so the entire
          account control surface sits in one cluster. Bell stays here
          on collapsed-state mobile/narrow viewports as a safety net. */}
      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <NotificationBell />
        </div>
      </div>
    </aside>
  );
}
