"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, AUDIENCE_NAV_GROUPS, type PortalNavOrg } from "./portal-nav";
import { BRAND_NAME } from "@/lib/brand";

export function MobileNavDrawer({ org }: { org: PortalNavOrg }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 w-72 bg-card border-r border-border flex flex-col shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
          <Link
            href="/portal"
            onClick={() => setOpen(false)}
            aria-label={`${BRAND_NAME} portal home`}
          >
            <Image
              src="/logos/leasestack-wordmark.png"
              alt={BRAND_NAME}
              width={110}
              height={20}
              className="h-5 w-auto"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <p className="text-xs font-medium text-foreground truncate">{org.name}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            Portal
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-3" aria-label="Portal navigation">
          {(org.isAudienceSync ? AUDIENCE_NAV_GROUPS : NAV_GROUPS).map((group) => {
            const visible = group.items.filter((item) => item.show(org));
            if (!visible.length) return null;
            return (
              <div key={group.label} className="mb-3">
                <div className="flex items-center gap-2 px-4 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="px-2 space-y-0.5">
                  {visible.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/portal" && pathname?.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                          active
                            ? "border-l-2 border-primary pl-[10px] pr-3 bg-accent text-primary"
                            : "border-l-2 border-transparent pl-[10px] pr-3 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
