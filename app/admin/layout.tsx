import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { AdminMobileNav } from "./mobile-nav";
import { AdminSidebar } from "./admin-sidebar";
import { AdminNotifications } from "@/components/admin-notifications";
import { BRAND_NAME } from "@/lib/brand";
import { getScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { CreativeRequestStatus, OrgType, TenantStatus } from "@prisma/client";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    template: `%s | ${BRAND_NAME} Admin`,
    default: `${BRAND_NAME} Admin`,
  },
  robots: { index: false, follow: false },
};

// Cache nav badge counts for 60 seconds to avoid N-query fan-out on every
// admin page load.
const getAdminNavBadges = unstable_cache(
  async () => {
    const [pendingIntakes, activeBuilds, openCreative, atRiskTenants] =
      await Promise.all([
        prisma.intakeSubmission.count({
          where: { reviewedAt: null, convertedAt: null },
        }).catch(() => 0),
        prisma.organization.count({
          where: {
            orgType: OrgType.CLIENT,
            status: {
              in: [
                TenantStatus.CONTRACT_SIGNED,
                TenantStatus.BUILD_IN_PROGRESS,
                TenantStatus.QA,
              ],
            },
          },
        }).catch(() => 0),
        prisma.creativeRequest.count({
          where: {
            status: {
              in: [
                CreativeRequestStatus.SUBMITTED,
                CreativeRequestStatus.IN_REVIEW,
                CreativeRequestStatus.IN_PROGRESS,
              ],
            },
          },
        }).catch(() => 0),
        prisma.organization.count({
          where: { orgType: OrgType.CLIENT, status: TenantStatus.AT_RISK },
        }).catch(() => 0),
      ]);
    return {
      pendingIntakes,
      activeBuilds,
      openCreative,
      atRiskTenants,
      unreadMessages: 0,
    } as Record<string, number>;
  },
  ["admin-nav-badges"],
  { revalidate: 60, tags: ["admin-nav-badges"] }
);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (!scope.isAgency) {
    redirect("/portal");
  }

  const navBadges = await getAdminNavBadges();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Mobile top header */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <AdminMobileNav navBadges={navBadges} />
          <span className="text-base font-bold tracking-tight text-foreground">
            {BRAND_NAME} Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <AdminNotifications />
          <UserButton />
        </div>
      </div>

      <div className="flex h-[calc(100dvh-3.5rem)] md:h-screen overflow-hidden">
        <AdminSidebar navBadges={navBadges} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background"
        >
          <div className="p-4 pb-20 md:p-5 md:pb-8 lg:p-6 xl:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
