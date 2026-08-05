"use client";

import { useState } from "react";
import Image from "next/image";
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
import { BRAND_NAME } from "@/lib/brand";
import { AdminNavList } from "./admin-nav-list";

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
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-card">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2.5">
            <Image
              src="/favicon.svg"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 shrink-0"
              aria-hidden="true"
            />
            <div className="text-left">
              <span className="block text-sm font-semibold text-foreground">
                {BRAND_NAME}
              </span>
              <span className="block text-[10px] font-semibold text-primary uppercase tracking-widest">
                Admin
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav className="overflow-y-auto py-4" aria-label="Admin navigation">
          <AdminNavList
            pathname={pathname}
            navBadges={navBadges}
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
