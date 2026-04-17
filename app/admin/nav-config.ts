import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  MessageSquare,
  Sparkles,
  FileInput,
  Kanban,
  Mail,
  History,
  ShoppingCart,
  Truck,
  Package,
  Warehouse,
  FileText,
  Tag,
  Boxes,
  Briefcase,
  UserCheck,
  ListChecks,
  TrendingUp,
  Store,
  Zap,
  HandCoins,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "pendingIntakes" | "activeBuilds" | "unreadMessages";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped navigation — collapsible sections in sidebar
export const adminNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/fulfillment", label: "Fulfillment", icon: Package },
      { href: "/admin/shipments", label: "Shipments", icon: Truck },
      { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
      { href: "/admin/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/quotes", label: "Quotes", icon: HandCoins },
    ],
  },
  {
    label: "Clients",
    items: [
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare, badgeKey: "unreadMessages" },
      { href: "/admin/wholesale", label: "Wholesale", icon: Briefcase },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Boxes },
      { href: "/admin/pricing", label: "Pricing", icon: Tag },
      { href: "/admin/drops", label: "Drops", icon: Zap },
      { href: "/admin/suppliers", label: "Suppliers", icon: Store },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/leads", label: "Leads", icon: TrendingUp },
      { href: "/admin/intakes", label: "Intakes", icon: FileInput, badgeKey: "pendingIntakes" },
      { href: "/admin/pipeline", label: "Pipeline", icon: Kanban, badgeKey: "activeBuilds" },
      { href: "/admin/reps", label: "Sales Reps", icon: UserCheck },
      { href: "/admin/subscribers", label: "Subscribers", icon: Mail },
      { href: "/admin/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/ceo", label: "CEO Dashboard", icon: TrendingUp },
      { href: "/admin/audit-log", label: "Audit Log", icon: History },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/chat", label: "AI Assistant", icon: Sparkles },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

// Flat list for backward compat (mobile nav, etc.)
export const adminNav = adminNavGroups.flatMap((g) => g.items);
