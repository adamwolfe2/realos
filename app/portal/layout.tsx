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
import { TrialBanner } from "@/components/portal/trial-banner";
import { resolveTrialState } from "@/lib/billing/trial-status";
import { AlertBanner } from "@/components/portal/ui/alert-banner";
import { getAppFolioStatus } from "@/lib/integrations/appfolio-status";

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
    appfolioStatus,
    pendingCurationCount,
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
        onboardingStep: true,
        chosenTier: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
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
    // Portfolio-wide health probe — surfaced as a single banner below the
    // impersonation strip so users see staleness everywhere, not just on
    // Residents / Renewals.
    getAppFolioStatus(scope.orgId).catch(() => null),
    // Property curation queue gauge. After every AppFolio sync, new rows
    // land as IMPORTED and need operator approval before they count toward
    // billing. We surface a global banner here so the operator can't miss
    // the queue — addresses the billing-safety concern that AppFolio sync
    // would otherwise silently bill for properties (parking, storage,
    // sub-records) the operator never wanted LeaseStack to manage.
    prisma.property
      .count({ where: { orgId: scope.orgId, lifecycle: "IMPORTED" } })
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

  // Self-serve onboarding gate. If the org is still mid-wizard (set by
  // lib/auth/provision.ts on signup; advanced by the wizard's own API
  // endpoints), bounce them back so they can finish setup before the
  // portal loads with empty state. Existing orgs created before this
  // column existed leave onboardingStep null and are unaffected.
  // Agency users impersonating a client skip the gate so they can
  // support customers mid-wizard.
  if (
    !scope.isImpersonating &&
    org.onboardingStep &&
    org.onboardingStep !== "done"
  ) {
    redirect("/onboarding");
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

  // Portfolio-wide stale-data banner inputs. Surfacing this once at the
  // layout level lets us delete the per-page red banners on Residents and
  // Renewals (and prevents the user from missing the issue when landing
  // anywhere else first).
  const showStaleBanner =
    !!appfolioStatus &&
    (appfolioStatus.state === "failed" || appfolioStatus.stale) &&
    Boolean(appfolioIntegration?.instanceSubdomain);
  const staleAgeDays =
    showStaleBanner && appfolioStatus?.lastSyncAt
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(appfolioStatus.lastSyncAt).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null;

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

      {/* Trial banner — shows during TRIALING (active and expired
          both). Hidden the moment subscriptionStatus flips to ACTIVE
          / CANCELED. The banner copy and the activate CTA adapt to
          the expired vs. active state via the daysLeft computation. */}
      {(() => {
        const trialState = resolveTrialState({
          subscriptionStatus: org.subscriptionStatus,
          trialStartedAt: null,
          trialEndsAt: org.trialEndsAt,
        });
        if (
          (trialState === "trial_active" ||
            trialState === "trial_expired") &&
          org.trialEndsAt
        ) {
          return (
            <TrialBanner
              trialEndsAt={org.trialEndsAt}
              propertyCount={propertyCount}
              tier={org.chosenTier ?? org.subscriptionTier ?? null}
            />
          );
        }
        return null;
      })()}

      {/* Impersonation strip — slim (28px) so it reads as page chrome
          rather than competing with content. Still uses the destructive
          token because impersonation is a security-critical state, but
          the visual weight is dialed back per the design audit. */}
      {scope.isImpersonating ? (
        <div
          role="status"
          className="shrink-0 h-7 bg-destructive/10 border-b border-destructive/30 text-destructive text-[11px] px-4 flex items-center justify-between gap-3"
        >
          <span className="truncate">
            Impersonating <strong>{org.name}</strong>. Changes attributed to you.
          </span>
          <form action="/api/admin/impersonate/end" method="post">
            <button
              type="submit"
              className="underline underline-offset-2 font-semibold hover:no-underline whitespace-nowrap"
            >
              End impersonation
            </button>
          </form>
        </div>
      ) : null}

      {/* Portfolio-wide data-health banner. Slim 28px chrome strip so it
          coexists with the impersonation + curation banners without
          eating 150px of vertical space. */}
      {showStaleBanner ? (
        <AlertBanner
          severity="warning"
          flush
          title={
            appfolioStatus.state === "failed"
              ? "AppFolio sync failed."
              : "AppFolio data is stale."
          }
          action={{ label: "Open integration", href: "/portal/connect" }}
        >
          {staleAgeDays != null
            ? `Last sync ${staleAgeDays}d ago. KPIs reflect that sync.`
            : "KPIs reflect the last successful sync."}
        </AlertBanner>
      ) : null}

      {/* Pending property review — surfaced globally so operators can't
          accidentally bill for AppFolio sub-records (parking, storage)
          they never wanted LeaseStack to manage. */}
      {pendingCurationCount > 0 ? (
        <AlertBanner
          severity="info"
          flush
          title={
            pendingCurationCount === 1
              ? `1 new AppFolio record pending review.`
              : `${pendingCurationCount.toLocaleString()} new AppFolio records pending review.`
          }
          action={{
            label: "Review now",
            href: "/portal/properties/curate",
          }}
        >
          Approve only the buildings you want marketed. Only approved properties count toward billing.
        </AlertBanner>
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
