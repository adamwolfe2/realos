"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";
import { adminNavGroups } from "./nav-config";

export function AdminSidebar({
  navBadges,
}: {
  navBadges: Record<string, number>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("admin-sidebar-collapsed");
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
      localStorage.setItem("admin-sidebar-collapsed", String(next));
    } catch {
      // ignore
    }
  }

  return (
    <aside
      className={cn(
        "relative hidden md:flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 min-w-0"
          aria-label={`${BRAND_NAME} admin home`}
        >
          <div className="shrink-0 h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-serif font-bold text-sm">
            {BRAND_NAME.slice(0, 1)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="block font-serif font-bold text-sm text-foreground tracking-tight truncate">
                {BRAND_NAME}
              </span>
              <span className="block text-[10px] font-semibold text-primary uppercase tracking-widest">
                Admin
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {adminNavGroups.map((group, groupIdx) => (
          <motion.div
            key={group.label}
            className="mb-4"
            initial={mounted ? { opacity: 0, x: -16 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.35,
              delay: 0.05 + groupIdx * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {!collapsed && (
              <div className="flex items-center gap-2 px-4 mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            <div className="px-2 space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" &&
                    pathname?.startsWith(item.href + "/")) ||
                  (item.href !== "/admin" && pathname === item.href);
                const badgeCount = item.badgeKey
                  ? (navBadges[item.badgeKey] ?? 0)
                  : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "border-l-2 border-primary pl-[10px] pr-3 bg-accent text-primary"
                        : "border-l-2 border-transparent pl-[10px] pr-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:pl-[14px]"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {badgeCount > 0 && (
                      <span
                        className={cn(
                          "shrink-0 min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold inline-flex items-center justify-center",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/15 text-primary",
                          collapsed &&
                            "absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 text-[9px]"
                        )}
                        aria-label={`${badgeCount} pending`}
                      >
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        ))}
      </nav>

      {/* Public site link */}
      {!collapsed && (
        <div className="px-4 py-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View public site
          </a>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleCollapsed}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted transition-colors z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* User */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <UserButton />
          {!collapsed && (
            <span className="text-sm text-muted-foreground truncate flex-1">
              Admin
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
