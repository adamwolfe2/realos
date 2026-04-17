import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminMobileNav } from "./mobile-nav";
import { AdminSidebar } from "./admin-sidebar";
import { AdminNotifications } from "@/components/admin-notifications";
import { BRAND_NAME } from "@/lib/brand";
import { UserRole } from "@prisma/client";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    template: `%s | ${BRAND_NAME} Admin`,
    default: `${BRAND_NAME} Admin`,
  },
  robots: { index: false, follow: false },
};

const ALLOWED_ROLES: readonly UserRole[] = [
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const dbUser = await prisma.user
    .findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    })
    .catch(() => null);

  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) {
    redirect("/");
  }

  // TODO(Sprint 04): nav badges for pending intakes, at-risk tenants,
  // unresolved creative requests, and impersonation banner.
  const navBadges: Record<string, number> = {};

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
