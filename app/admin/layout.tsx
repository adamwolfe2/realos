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
    <div className="flex min-h-screen bg-cream">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-ink focus:text-cream focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <aside className="w-60 border-r border-shell bg-cream hidden md:flex md:flex-col overflow-y-auto">
        <div className="mb-4 px-6 pt-5">
          <Link
            href="/admin"
            className="font-serif font-bold text-xl text-ink tracking-tight"
          >
            {BRAND_NAME}
          </Link>
          <p className="font-serif italic text-sm text-sand mt-0.5">Admin</p>
        </div>
        <AdminSidebar navBadges={navBadges} />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-shell px-4 md:px-6 py-3 flex items-center justify-between bg-cream">
          <div className="flex items-center gap-3">
            <AdminMobileNav navBadges={navBadges} />
            <span className="font-serif font-bold text-base text-ink md:hidden">
              {BRAND_NAME}
            </span>
            <span className="font-serif font-bold text-lg text-ink hidden md:block">
              {BRAND_NAME} Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AdminNotifications />
            <UserButton />
          </div>
        </header>
        <main
          id="main-content"
          className="flex-1 p-3 sm:p-4 md:p-6 animate-fade-in bg-cream"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
