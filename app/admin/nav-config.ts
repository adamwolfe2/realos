import {
  LayoutDashboard,
  Users,
  FileInput,
  Kanban,
  Building2,
  Megaphone,
  Brush,
  MessageSquare,
  Activity,
  History,
  HeartPulse,
  Radio,
  Plug,
  Inbox,
  Sparkles,
  Bug,
  FileText,
  SatelliteDish,
  Globe,
  Store,
  DollarSign,
  FileSignature,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?:
    | "pendingIntakes"
    | "activeBuilds"
    | "unreadMessages"
    | "openCreative"
    | "atRiskTenants"
    | "pendingPixelRequests"
    | "openBugReports"
    | "pendingContentDrafts"
    | "pendingSiteRequests";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Admin nav config for LeaseStack. Distribution nav groups (orders, catalog,
// suppliers, shipments, etc.) removed. Groups reflect the four agency jobs
// we do every week: intake, pipeline, client care, creative.
// Nav targets that aren't built yet link to Sprint-specific placeholders.
// ---------------------------------------------------------------------------

export const adminNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      // Cross-portfolio insight triage. Aggregates every actionable
      // insight across every CLIENT org so the agency can get ahead
      // of fires before clients notice them.
      { href: "/admin/insights", label: "Insights", icon: Sparkles },
    ],
  },
  {
    label: "Growth",
    items: [
      {
        href: "/admin/intakes",
        label: "Intake queue",
        icon: FileInput,
        badgeKey: "pendingIntakes",
      },
      {
        href: "/admin/pipeline",
        label: "Pipeline",
        icon: Kanban,
        badgeKey: "activeBuilds",
      },
      {
        // Site Engine: hand-built marketing-site fulfillment queue. Public
        // intake landing at /sites/request, logged-in version at
        // /portal/sites/request. Lives here under Growth because every row
        // starts as inbound demand we triage.
        href: "/admin/site-engine",
        label: "Site engine",
        icon: Globe,
        badgeKey: "pendingSiteRequests",
      },
      { href: "/admin/leads", label: "Leads", icon: Activity },
      { href: "/admin/marketplace", label: "Marketplace sources", icon: Store },
      { href: "/admin/proposals", label: "Proposals", icon: FileSignature },
    ],
  },
  {
    label: "Clients",
    items: [
      { href: "/admin/clients", label: "All clients", icon: Users },
      {
        href: "/admin/creative-requests",
        label: "Creative queue",
        icon: Brush,
        badgeKey: "openCreative",
      },
      {
        href: "/admin/content-drafts",
        label: "Content drafts",
        icon: FileText,
        badgeKey: "pendingContentDrafts",
      },
      { href: "/admin/campaigns", label: "Ad campaigns", icon: Megaphone },
      {
        href: "/admin/pixel-requests",
        label: "Pixel requests",
        icon: Inbox,
        badgeKey: "pendingPixelRequests",
      },
      { href: "/admin/pixel", label: "Pixel health", icon: Radio },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/tenants", label: "Tenants + domains", icon: Building2 },
      {
        href: "/admin/site-intelligence",
        label: "Site intelligence",
        icon: SatelliteDish,
      },
      {
        href: "/admin/integrations/appfolio",
        label: "AppFolio sync",
        icon: Plug,
      },
      { href: "/admin/system", label: "System health", icon: HeartPulse },
      { href: "/admin/system/seo-agent", label: "SEO Agent metrics", icon: Activity },
      { href: "/admin/costs", label: "API costs", icon: DollarSign },
      { href: "/admin/audit-log", label: "Audit log", icon: History },
      { href: "/admin/chat", label: "Support", icon: MessageSquare },
      {
        href: "/admin/bug-reports",
        label: "Bug reports",
        icon: Bug,
        badgeKey: "openBugReports",
      },
    ],
  },
];

export const adminNav = adminNavGroups.flatMap((g) => g.items);
