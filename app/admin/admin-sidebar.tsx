"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminNavGroups, type NavGroup } from "./nav-config";
import { motion } from "framer-motion";

const STORAGE_KEY = "admin-nav-collapsed";

function getInitialCollapsed(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function AdminSidebar({
  navBadges,
}: {
  groups?: NavGroup[]; // deprecated — imported directly to avoid passing functions across server/client boundary
  navBadges: Record<string, number>;
}) {
  const groups = adminNavGroups;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(getInitialCollapsed());
    setMounted(true);
  }, []);

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <nav className="flex-1 px-3 pb-5 space-y-1 overflow-y-auto">
      {groups.map((group) => {
        const isCollapsed = mounted && collapsed[group.label];
        // Auto-expand group if current page is in it
        const isActiveGroup = group.items.some(
          (item) =>
            pathname === item.href ||
            (item.href !== "/admin" && pathname?.startsWith(item.href)),
        );

        return (
          <div key={group.label}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.label)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/40 hover:text-ink/60 transition-colors"
            >
              {group.label}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  isCollapsed && !isActiveGroup && "-rotate-90",
                )}
              />
            </button>

            {/* Group items */}
            {(!isCollapsed || isActiveGroup) && (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname?.startsWith(item.href));
                  const badgeCount = item.badgeKey
                    ? (navBadges[item.badgeKey] ?? 0)
                    : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "text-cream"
                          : "text-ink/60 hover:bg-ink/[0.06] hover:text-ink",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="admin-nav-indicator"
                          className="absolute inset-0 bg-ink"
                          style={{ borderRadius: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                      <item.icon className="relative h-4 w-4 shrink-0" />
                      <span className="relative">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="relative ml-auto text-[10px] font-bold bg-ink text-cream px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
