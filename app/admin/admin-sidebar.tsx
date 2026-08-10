"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";
import { AdminNavList } from "./admin-nav-list";

export function AdminSidebar({
  navBadges,
}: {
  navBadges: Record<string, number>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("admin-sidebar-collapsed");
      if (stored) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  function persistCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem("admin-sidebar-collapsed", String(next));
    } catch {
      // ignore
    }
  }

  function toggleCollapsed() {
    persistCollapsed(!collapsed);
  }

  return (
    <aside
      className={cn(
        "relative hidden lg:flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        <Link
          href="/admin"
          className="flex items-center min-w-0"
          aria-label={`${BRAND_NAME} admin home`}
        >
          {collapsed ? (
            // Match the portal sidebar — use the canonical /favicon.svg
            // mark so the collapsed admin chrome reads as the same brand
            // identity as the wordmark and the browser tab.
            <Image
              src="/favicon.svg"
              alt={BRAND_NAME}
              width={24}
              height={24}
              className="w-6 h-6 shrink-0"
              unoptimized
              priority
            />
          ) : (
            <div className="min-w-0">
              <Image
                src="/logos/leasestack-wordmark.png"
                alt={BRAND_NAME}
                width={140}
                height={28}
                className="h-7 w-auto"
                priority
              />
              <span className="block text-[10px] font-semibold text-primary uppercase tracking-widest mt-0.5">
                Admin
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4" aria-label="Admin navigation">
        <AdminNavList
          pathname={pathname}
          navBadges={navBadges}
          collapsed={collapsed}
          onRequestExpand={() => persistCollapsed(false)}
        />
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
