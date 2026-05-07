import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { BRAND_NAME } from "@/lib/brand";
import { PortalNav } from "@/components/portal/portal-nav";
import { MobileNavDrawer } from "@/components/portal/mobile-nav-drawer";
import { deriveSetupProgress } from "@/lib/setup/derive-progress";
import Image from "next/image";
import Link from "next/link";
import { NotificationBell } from "@/components/portal/notification-bell";
import { CmdKSearch } from "@/components/portal/search/cmdk-search";
import { BugReportButton } from "@/components/feedback/bug-report-button";

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

  // Sidebar gating queries — kept lightweight (count-only) so the layout
  // doesn't pay a heavy cost on every page navigation. We check existence
  // (take: 1) instead of full counts to short-circuit at the first row.
  const [
    org,
    appfolioIntegration,
    insightCount,
    reportCount,
    creativeCount,
    leadCount,
    propertyCount,
    tourCount,
    applicationCount,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        orgType: true,
        productLine: true,
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
    }),
    prisma.appFolioIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: { instanceSubdomain: true, autoSyncEnabled: true },
    }),
    prisma.insight.count({ where: { orgId: scope.orgId } }).catch(() => 0),
    prisma.clientReport.count({ where: { orgId: scope.orgId } }).catch(() => 0),
    prisma.creativeRequest
      .count({ where: { orgId: scope.orgId } })
      .catch(() => 0),
    prisma.lead.count({ where: { orgId: scope.orgId } }).catch(() => 0),
    // Sidebar count — must match the dashboard tile and the
    // /portal/properties list. Marketable lifecycle only.
    prisma.property
      .count({ where: marketablePropertyWhere(scope.orgId) })
      .catch(() => 0),
    // Tours come from the public booking form (/api/public/tours) and the
    // API-key tour ingestion endpoint (/api/ingest/tour) — NOT AppFolio
    // (showings is a v1 CRUD entity, not a v2 report). Hide the nav until
    // a real tour exists so brand-new tenants don't see a dead surface.
    prisma.tour
      .count({ where: { lead: { orgId: scope.orgId } } })
      .catch(() => 0),
    // Applications currently have no production write path. The page
    // hides until rows exist, which today only happens via demo seeding.
    // TODO: wire AppFolio rental_application_status (or equivalent)
    // into runAppfolioSync, OR build a public application form, before
    // surfacing this to operators as a feature.
    prisma.application
      .count({ where: { lead: { orgId: scope.orgId } } })
      .catch(() => 0),
  ]);

  if (!org) {
    redirect(scope.isAgency || scope.isAlPartner ? "/admin" : "/sign-in");
  }
  // AL_PARTNER users without an impersonation target land on the audiences
  // catalog. Don't bounce them to /admin since they don't have agency UI.
  if (org.orgType !== "CLIENT" && !scope.isAlPartner) {
    redirect(scope.isAgency ? "/admin" : "/sign-in");
  }

  const setupProgress = await deriveSetupProgress(scope.orgId);
  const setupComplete =
    setupProgress != null &&
    setupProgress.completedCount === setupProgress.totalCount;

  const isAudienceSync = org.productLine === "AUDIENCE_SYNC";

  const navOrg = {
    name: org.name,
    productLine: org.productLine,
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
    isAudienceSync,
    // Show Operations (residents / renewals / work orders) only when AppFolio
    // is configured — the pages show empty states otherwise and confuse users.
    appFolioConnected: Boolean(appfolioIntegration?.instanceSubdomain),
    // Soft-gate Analytics-tier nav so brand-new tenants don't see five
    // empty pages they have to ignore. Items appear in the sidebar the
    // moment their underlying tables have at least one row.
    hasInsights: insightCount > 0,
    hasReports: reportCount > 0,
    hasCreativeRequests: creativeCount > 0,
    briefingHasContent: leadCount > 0 && propertyCount > 0,
    // Honest disclosure for Audience nav: only show Tours / Applications
    // once a real row exists, since neither is currently AppFolio-backed.
    // Power users can still URL-navigate to the empty pages; we just
    // remove the dead-end click from the sidebar so feature surface
    // matches what's actually wired.
    hasTours: tourCount > 0,
    hasApplications: applicationCount > 0,
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <div className="md:hidden shrink-0 flex items-center justify-between h-14 px-4 bg-card border-b border-border z-40">
        <div className="flex items-center gap-2">
          <MobileNavDrawer org={navOrg} />
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
        </div>
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
          className="flex-1 overflow-y-auto bg-background flex flex-col"
        >
          {/* Desktop top utility bar — search + notifications. Search button
              hidden on mobile (Cmd+K still works); mobile already has its
              own top bar above. */}
          <div className="hidden md:flex shrink-0 h-12 items-center justify-end gap-2 px-6 border-b border-border bg-card/40">
            <CmdKSearch />
            <NotificationBell />
          </div>
          <div className="flex-1 p-4 pb-20 md:p-6 md:pb-10">{children}</div>
        </main>
      </div>

      <BugReportButton />
    </div>
  );
}
