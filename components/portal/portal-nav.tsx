"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Eye,
  MessageSquare,
  Megaphone,
  Brush,
  Globe,
  CreditCard,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PortalNavOrg = {
  moduleWebsite: boolean;
  modulePixel: boolean;
  moduleChatbot: boolean;
  moduleGoogleAds: boolean;
  moduleMetaAds: boolean;
  moduleCreativeStudio: boolean;
  bringYourOwnSite: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (org: PortalNavOrg) => boolean;
};

const ALWAYS = () => true;

const NAV: NavItem[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, show: ALWAYS },
  { href: "/portal/properties", label: "Properties", icon: Building2, show: ALWAYS },
  { href: "/portal/leads", label: "Leads", icon: Users, show: ALWAYS },
  {
    href: "/portal/visitors",
    label: "Visitors",
    icon: Eye,
    show: (o) => o.modulePixel,
  },
  {
    href: "/portal/conversations",
    label: "Conversations",
    icon: MessageSquare,
    show: (o) => o.moduleChatbot,
  },
  {
    href: "/portal/campaigns",
    label: "Campaigns",
    icon: Megaphone,
    show: (o) => o.moduleGoogleAds || o.moduleMetaAds,
  },
  {
    href: "/portal/creative",
    label: "Creative",
    icon: Brush,
    show: (o) => o.moduleCreativeStudio,
  },
  {
    href: "/portal/site-builder",
    label: "Site builder",
    icon: Globe,
    show: (o) => o.moduleWebsite && !o.bringYourOwnSite,
  },
  { href: "/portal/billing", label: "Billing", icon: CreditCard, show: ALWAYS },
  { href: "/portal/settings", label: "Settings", icon: Settings, show: ALWAYS },
];

export function PortalNav({ org }: { org: PortalNavOrg }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => item.show(org));

  return (
    <nav aria-label="Portal" className="flex flex-wrap gap-1 border-b bg-background px-4 md:px-6">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/portal" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 text-xs md:text-sm border-b-2 -mb-px",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
