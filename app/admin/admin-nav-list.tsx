"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  activeAdminNavHref,
  adminNavSections,
  isAdminNavEntryActive,
  navEntryBadgeCount,
  type NavCluster,
  type NavItem,
} from "./nav-config";

type AdminNavListProps = {
  pathname: string;
  navBadges: Readonly<Record<string, number>>;
  collapsed?: boolean;
  onNavigate?: () => void;
  onRequestExpand?: () => void;
};

export function AdminNavList({
  pathname,
  navBadges,
  collapsed = false,
  onNavigate,
  onRequestExpand,
}: AdminNavListProps) {
  const activeCluster = findActiveCluster(pathname);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(activeCluster ? [activeCluster] : []),
  );

  useEffect(() => {
    if (!activeCluster) return;
    setExpanded((current) => new Set([...current, activeCluster]));
  }, [activeCluster]);

  function toggleCluster(label: string) {
    if (collapsed) {
      onRequestExpand?.();
      setExpanded((current) => new Set([...current, label]));
      return;
    }
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="space-y-1 px-2">
      {adminNavSections.map((entry) =>
        entry.type === "cluster" ? (
          <ClusterEntry
            key={entry.label}
            entry={entry}
            pathname={pathname}
            navBadges={navBadges}
            expanded={!collapsed && expanded.has(entry.label)}
            collapsed={collapsed}
            onToggle={() => toggleCluster(entry.label)}
            onNavigate={onNavigate}
          />
        ) : (
          <LinkEntry
            key={entry.href}
            item={entry}
            active={isAdminNavEntryActive(entry, pathname)}
            badgeCount={navEntryBadgeCount(entry, navBadges)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ),
      )}
    </div>
  );
}

function ClusterEntry({
  entry,
  pathname,
  navBadges,
  expanded,
  collapsed,
  onToggle,
  onNavigate,
}: {
  entry: NavCluster;
  pathname: string;
  navBadges: Readonly<Record<string, number>>;
  expanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const panelId = `${useId()}-admin-nav-panel`;
  const active = isAdminNavEntryActive(entry, pathname);
  const badgeCount = navEntryBadgeCount(entry, navBadges);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={collapsed ? entry.label : undefined}
        title={collapsed ? entry.label : undefined}
        className={entryClass(active, collapsed)}
      >
        <entry.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="flex-1 text-left">{entry.label}</span>}
        <Badge count={badgeCount} active={active} collapsed={collapsed} />
        {!collapsed && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </button>
      {expanded && (
        <div id={panelId} className="ml-5 mt-1 space-y-0.5 border-l border-border pl-2">
          {entry.items.map((item) => (
            <LinkEntry
              key={item.href}
              item={item}
              active={activeAdminNavHref(pathname) === item.href}
              badgeCount={navEntryBadgeCount(item, navBadges)}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkEntry({
  item,
  active,
  badgeCount,
  collapsed = false,
  nested = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badgeCount: number;
  collapsed?: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(entryClass(active, collapsed), nested && "h-9 text-[13px]")}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      <Badge count={badgeCount} active={active} collapsed={collapsed} />
    </Link>
  );
}

function Badge({
  count,
  active,
  collapsed,
}: {
  count: number;
  active: boolean;
  collapsed: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
        active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
        collapsed && "absolute right-0.5 top-0.5 h-3.5 min-w-3.5 px-0.5 text-[9px]",
      )}
      aria-label={`${count} pending`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function entryClass(active: boolean, collapsed: boolean): string {
  return cn(
    "relative flex h-10 w-full items-center gap-3 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    active
      ? "bg-accent text-primary"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    collapsed && "justify-center px-0",
  );
}

function findActiveCluster(pathname: string): string | null {
  const active = adminNavSections.find(
    (entry): entry is NavCluster =>
      entry.type === "cluster" && isAdminNavEntryActive(entry, pathname),
  );
  return active?.label ?? null;
}
