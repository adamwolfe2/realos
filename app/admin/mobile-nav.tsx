"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { adminNavGroups } from "./nav-config";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";

export function AdminMobileNav({
  navBadges = {},
}: {
  navBadges?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-card">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="shrink-0 h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-serif font-bold text-sm">
              {BRAND_NAME.slice(0, 1)}
            </div>
            <div className="text-left">
              <span className="block font-serif font-bold text-sm text-foreground">
                {BRAND_NAME}
              </span>
              <span className="block text-[10px] font-semibold text-primary uppercase tracking-widest">
                Admin
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav className="py-4 overflow-y-auto">
          {adminNavGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="flex items-center gap-2 px-4 mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="px-2 space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      pathname.startsWith(item.href + "/"));
                  const badgeCount = item.badgeKey
                    ? (navBadges[item.badgeKey] ?? 0)
                    : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg py-2 px-3 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 && (
                        <span
                          className={cn(
                            "shrink-0 min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold inline-flex items-center justify-center",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/15 text-primary"
                          )}
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
