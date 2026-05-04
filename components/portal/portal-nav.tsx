"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/portal/notification-bell";
import { BRAND_NAME } from "@/lib/brand";

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
  bringYourOwnSite: boolean;
  onboardingDismissed: boolean;
  setupComplete: boolean;
  isAudienceSync?: boolean;
  /** True when an AppFolio integration record exists — gates Operations nav group */
  appFolioConnected?: boolean;
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
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (org: PortalNavOrg) => boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const ALWAYS = () => true;

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

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/portal/setup",
        label: "Setup",
        icon: Compass,
        show: (o) => !o.setupComplete && !o.onboardingDismissed,
      },
      { href: "/portal", label: "Dashboard", icon: LayoutDashboard, show: ALWAYS },
    ],
  },
  {
    label: "Analytics",
    items: [
      // Attribution is the direct competitor surface to Clarity Attribution
      // — same charts Clarity charges $5–10k/property/month for, included
      // as table stakes. Always visible because it's a marketing-led
      // value prop and we want it to be the first thing prospects see
      // after the dashboard.
      {
        href: "/portal/attribution",
        label: "Attribution",
        icon: PieChart,
        show: ALWAYS,
      },
      // Each remaining Analytics page hides when its source data is
      // empty so the sidebar doesn't surface dead-end clicks. The pages
      // remain reachable by URL for power users; we just hide the entry
      // point until there's something to show.
      {
        href: "/portal/briefing",
        label: "Briefing",
        icon: Gauge,
        show: (o) => Boolean(o.briefingHasContent),
      },
      {
        href: "/portal/insights",
        label: "Insights",
        icon: Sparkles,
        show: (o) => Boolean(o.hasInsights),
      },
      {
        href: "/portal/reports",
        label: "Reports",
        icon: FileText,
        show: (o) => Boolean(o.hasReports),
      },
    ],
  },
  {
    label: "Audience",
    items: [
      { href: "/portal/properties", label: "Properties", icon: Building2, show: ALWAYS },
      { href: "/portal/leads", label: "Leads", icon: Users, show: ALWAYS },
      // Tours: gated on at least one tour existing. Source is the public
      // booking form or the API-key ingest endpoint — NOT AppFolio.
      { href: "/portal/tours", label: "Tours", icon: Calendar, show: (o) => Boolean(o.hasTours) },
      // Applications: gated until rows exist. There is no production
      // write path today; surfacing an empty page as a "feature" misleads
      // operators about what the platform can do.
      { href: "/portal/applications", label: "Applications", icon: ClipboardList, show: (o) => Boolean(o.hasApplications) },
      {
        href: "/portal/visitors",
        label: "Visitors",
        icon: Eye,
        show: (o) => o.modulePixel,
      },
      { href: "/portal/reputation", label: "Reputation", icon: Star, show: ALWAYS },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/portal/residents", label: "Residents", icon: Home, show: (o) => Boolean(o.appFolioConnected) },
      { href: "/portal/renewals", label: "Renewals", icon: CalendarClock, show: (o) => Boolean(o.appFolioConnected) },
      { href: "/portal/work-orders", label: "Work orders", icon: Wrench, show: (o) => Boolean(o.appFolioConnected) },
    ],
  },
  {
    label: "Engage",
    items: [
      {
        href: "/portal/conversations",
        label: "Conversations",
        icon: MessageSquare,
        show: (o) => o.moduleChatbot,
      },
      {
        href: "/portal/chatbot",
        label: "Chatbot",
        icon: Bot,
        show: (o) => o.moduleChatbot,
      },
    ],
  },
  {
    label: "Advertising",
    items: [
      {
        href: "/portal/ads",
        label: "Ads",
        icon: BarChart3,
        show: (o) => o.moduleGoogleAds || o.moduleMetaAds,
      },
      {
        href: "/portal/campaigns",
        label: "Campaigns",
        icon: Megaphone,
        show: (o) => o.moduleGoogleAds || o.moduleMetaAds,
      },
      {
        href: "/portal/creative",
        label: "Creative",
        icon: Brush,
        // Only surface when the module is active AND the operator has
        // already filed at least one request. Until then it's an empty
        // request form that takes up sidebar real estate without
        // showing what the page actually does.
        show: (o) => o.moduleCreativeStudio && Boolean(o.hasCreativeRequests),
      },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/portal/seo", label: "SEO", icon: TrendingUp, show: (o) => o.moduleSEO },
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
      { href: "/portal/notifications", label: "Notifications", icon: Bell, show: ALWAYS },
      { href: "/portal/billing", label: "Billing", icon: CreditCard, show: ALWAYS },
      { href: "/portal/settings", label: "Settings", icon: Settings, show: ALWAYS },
    ],
  },
];

export function PortalNav({ org }: { org: PortalNavOrg }) {
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
        "relative hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center px-4 border-b border-border">
        <Link
          href="/portal"
          className="flex items-center min-w-0"
          aria-label={`${BRAND_NAME} portal home`}
        >
          {collapsed ? (
            <Image
              src="/icon-32x32.png"
              alt={BRAND_NAME}
              width={28}
              height={28}
              className="w-7 h-7 shrink-0"
              priority
            />
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Portal navigation">
        {(org.isAudienceSync ? AUDIENCE_NAV_GROUPS : NAV_GROUPS).map((group) => {
          const visible = group.items.filter((item) => item.show(org));
          if (!visible.length) return null;
          return (
            <div key={group.label} className="mb-3">
              {!collapsed && (
                <div className="flex items-center gap-2 px-4 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className="px-2 space-y-0.5">
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
                        "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                        active
                          ? "border-l-2 border-primary pl-[10px] pr-3 bg-accent text-primary"
                          : "border-l-2 border-transparent pl-[10px] pr-3 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
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

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <UserButton />
          {!collapsed && <NotificationBell />}
        </div>
      </div>
    </aside>
  );
}
