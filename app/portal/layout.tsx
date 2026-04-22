import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { BRAND_NAME } from "@/lib/brand";
import { PortalNav } from "@/components/portal/portal-nav";
import { deriveSetupProgress } from "@/lib/setup/derive-progress";
import Image from "next/image";
import Link from "next/link";
import { NotificationBell } from "@/components/portal/notification-bell";

export const metadata: Metadata = {
  title: { template: `%s | ${BRAND_NAME} Portal`, default: `${BRAND_NAME} Portal` },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");

  if (scope.isAgency && !scope.isImpersonating) {
    redirect("/admin");
  }

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      orgType: true,
      logoUrl: true,
      onboardingDismissed: true,
      moduleWebsite: true,
      modulePixel: true,
      moduleChatbot: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      moduleCreativeStudio: true,
      moduleSEO: true,
      moduleReferrals: true,
      bringYourOwnSite: true,
    },
  });

  if (!org || org.orgType !== "CLIENT") {
    redirect(scope.isAgency ? "/admin" : "/sign-in");
  }

  const setupProgress = await deriveSetupProgress(scope.orgId);
  const setupComplete =
    setupProgress != null &&
    setupProgress.completedCount === setupProgress.totalCount;

  const navOrg = {
    name: org.name,
    moduleWebsite: org.moduleWebsite,
    modulePixel: org.modulePixel,
    moduleChatbot: org.moduleChatbot,
    moduleGoogleAds: org.moduleGoogleAds,
    moduleMetaAds: org.moduleMetaAds,
    moduleCreativeStudio: org.moduleCreativeStudio,
    moduleSEO: org.moduleSEO,
    moduleReferrals: org.moduleReferrals,
    bringYourOwnSite: org.bringYourOwnSite,
    onboardingDismissed: org.onboardingDismissed,
    setupComplete,
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <div className="md:hidden shrink-0 flex items-center justify-between h-14 px-4 bg-card border-b border-border z-40">
        <Link href="/portal" aria-label={`${BRAND_NAME} portal home`}>
          <Image
            src="/logos/leasestack-wordmark.png"
            alt={BRAND_NAME}
            width={110}
            height={20}
            className="h-5 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <UserButton />
        </div>
      </div>

      {/* Impersonation banner */}
      {scope.isImpersonating ? (
        <div
          role="status"
          className="shrink-0 bg-amber-100 border-b border-amber-300 text-amber-900 text-xs px-4 py-2 flex items-center justify-between gap-3"
        >
          <span>
            Impersonating <strong>{org.name}</strong>. Changes are attributed to
            you in the audit log.
          </span>
          <form action="/api/admin/impersonate/end" method="post">
            <button
              type="submit"
              className="underline underline-offset-2 font-medium"
            >
              End impersonation
            </button>
          </form>
        </div>
      ) : null}

      {/* Main flex row — takes remaining height */}
      <div className="flex flex-1 min-h-0">
        <PortalNav org={navOrg} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background"
        >
          <div className="p-4 pb-20 md:p-6 md:pb-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
