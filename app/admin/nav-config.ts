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
    | "atRiskTenants";
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
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
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
      { href: "/admin/leads", label: "Leads", icon: Activity },
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
      { href: "/admin/campaigns", label: "Ad campaigns", icon: Megaphone },
      { href: "/admin/pixel", label: "Pixel health", icon: Radio },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/tenants", label: "Tenants + domains", icon: Building2 },
      {
        href: "/admin/integrations/appfolio",
        label: "AppFolio sync",
        icon: Plug,
      },
      { href: "/admin/system", label: "System health", icon: HeartPulse },
      { href: "/admin/audit-log", label: "Audit log", icon: History },
      { href: "/admin/chat", label: "Support", icon: MessageSquare },
    ],
  },
];

export const adminNav = adminNavGroups.flatMap((g) => g.items);
