import {
  Activity,
  Brush,
  Bug,
  Building2,
  DollarSign,
  FileInput,
  FileSignature,
  FileText,
  Globe,
  HeartPulse,
  History,
  Inbox,
  Kanban,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Plug,
  Radio,
  SatelliteDish,
  Settings,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminNavBadgeKey =
  | "pendingIntakes"
  | "activeBuilds"
  | "unreadMessages"
  | "openCreative"
  | "atRiskTenants"
  | "pendingPixelRequests"
  | "openBugReports"
  | "pendingContentDrafts"
  | "pendingSiteRequests";

export interface NavItem {
  type: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: AdminNavBadgeKey;
}

export interface NavCluster {
  type: "cluster";
  label: string;
  icon: LucideIcon;
  items: readonly NavItem[];
}

export type AdminNavEntry = NavItem | NavCluster;

function link(
  href: string,
  label: string,
  icon: LucideIcon,
  badgeKey?: AdminNavBadgeKey,
): NavItem {
  return { type: "link", href, label, icon, badgeKey };
}

function cluster(
  label: string,
  icon: LucideIcon,
  items: readonly NavItem[],
): NavCluster {
  return { type: "cluster", label, icon, items };
}

export const adminNavSections: readonly AdminNavEntry[] = [
  link("/admin", "Dashboard", LayoutDashboard),
  link("/admin/insights", "Insights", Sparkles),
  cluster("Pipeline", Kanban, [
    link("/admin/pipeline", "Pipeline overview", Kanban, "activeBuilds"),
    link("/admin/intakes", "Intake queue", FileInput, "pendingIntakes"),
    link("/admin/leads", "Leads", Activity),
    link("/admin/proposals", "Proposals", FileSignature),
    link("/admin/pricing", "Onboarding pricing", DollarSign),
  ]),
  cluster("Sites", Globe, [
    link("/admin/site-engine", "Site engine", Globe, "pendingSiteRequests"),
    link("/admin/site-intelligence", "Site intelligence", SatelliteDish),
  ]),
  link("/admin/marketplace", "Marketplace", Store),
  link("/admin/clients", "Clients", Users),
  cluster("Client work", Brush, [
    link("/admin/creative-requests", "Creative queue", Brush, "openCreative"),
    link(
      "/admin/content-drafts",
      "Content drafts",
      FileText,
      "pendingContentDrafts",
    ),
    link("/admin/campaigns", "Ad campaigns", Megaphone),
    link("/admin/pixel-requests", "Pixel requests", Inbox, "pendingPixelRequests"),
    link("/admin/pixel", "Pixel health", Radio),
  ]),
  cluster("System", Settings, [
    link("/admin/tenants", "Tenants + domains", Building2),
    link("/admin/integrations/appfolio", "AppFolio sync", Plug),
    link("/admin/system", "System health", HeartPulse),
    link("/admin/system/seo-agent", "SEO Agent metrics", Activity),
    link("/admin/costs", "API costs", DollarSign),
    link("/admin/audit-log", "Audit log", History),
    link("/admin/chat", "Support", MessageSquare),
    link("/admin/bug-reports", "Bug reports", Bug, "openBugReports"),
  ]),
] as const;

export const adminNav: readonly NavItem[] = adminNavSections.flatMap((entry) =>
  entry.type === "cluster" ? entry.items : [entry],
);

function pathMatches(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeAdminNavHref(pathname: string): string | null {
  const matches = adminNav.filter(({ href }) => pathMatches(pathname, href));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

export function isAdminNavEntryActive(
  entry: AdminNavEntry,
  pathname: string,
): boolean {
  const activeHref = activeAdminNavHref(pathname);
  if (!activeHref) return false;
  if (entry.type === "link") return entry.href === activeHref;
  return entry.items.some(({ href }) => href === activeHref);
}

export function navEntryBadgeCount(
  entry: AdminNavEntry,
  badges: Readonly<Record<string, number>>,
): number {
  if (entry.type === "link") {
    return entry.badgeKey ? (badges[entry.badgeKey] ?? 0) : 0;
  }
  return entry.items.reduce(
    (total, item) => total + navEntryBadgeCount(item, badges),
    0,
  );
}
