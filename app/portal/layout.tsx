import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { BRAND_NAME } from "@/lib/brand";
import { PortalNav } from "@/components/portal/portal-nav";
import { deriveSetupProgress } from "@/lib/setup/derive-progress";

export const metadata: Metadata = {
  title: { template: `%s | ${BRAND_NAME} Portal`, default: `${BRAND_NAME} Portal` },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Client portal shell. Middleware gates /portal/* so unauthenticated visitors
// redirect to /sign-in before this renders. When an agency user impersonates a
// client, the banner stays visible across every sub-route.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");

  // Agency users without an impersonation target shouldn't see the portal.
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
      bringYourOwnSite: true,
    },
  });

  if (!org || org.orgType !== "CLIENT") {
    redirect(scope.isAgency ? "/admin" : "/sign-in");
  }

  // Setup completion drives whether we show the "Setup" nav entry. Once
  // every step is done (or the operator dismissed onboarding), the tab
  // vanishes and the nav simplifies.
  const setupProgress = await deriveSetupProgress(scope.orgId);
  const setupComplete =
    setupProgress != null &&
    setupProgress.completedCount === setupProgress.totalCount;

  const navOrg = {
    moduleWebsite: org.moduleWebsite,
    modulePixel: org.modulePixel,
    moduleChatbot: org.moduleChatbot,
    moduleGoogleAds: org.moduleGoogleAds,
    moduleMetaAds: org.moduleMetaAds,
    moduleCreativeStudio: org.moduleCreativeStudio,
    moduleSEO: org.moduleSEO,
    bringYourOwnSite: org.bringYourOwnSite,
    onboardingDismissed: org.onboardingDismissed,
    setupComplete,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {scope.isImpersonating ? (
        <div
          role="status"
          className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs md:text-sm px-4 py-2 flex items-center justify-between gap-3"
        >
          <span>
            Impersonating <strong>{org.name}</strong>. Changes are attributed
            to you in the audit log.
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

      <header className="border-b border-border px-4 md:px-6 py-3 flex items-center justify-between bg-card">
        <Link
          href="/portal"
          className="flex items-center gap-2.5 min-w-0"
          aria-label={`${BRAND_NAME} portal home`}
        >
          <div className="shrink-0 h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-serif font-bold text-sm">
            {BRAND_NAME.slice(0, 1)}
          </div>
          <div className="min-w-0 hidden sm:block">
            <span className="block font-serif font-bold text-sm text-foreground tracking-tight truncate">
              {BRAND_NAME}
            </span>
            <span className="block text-[10px] font-semibold text-primary uppercase tracking-widest">
              Portal
            </span>
          </div>
          <span className="hidden md:inline text-xs text-muted-foreground border-l border-border pl-3 ml-1 truncate">
            {org.name}
          </span>
        </Link>
        <UserButton />
      </header>

      <PortalNav org={navOrg} />

      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6">
        {children}
      </main>

      <footer className="border-t px-4 md:px-6 py-3 text-xs opacity-60 flex items-center justify-end">
        <Link
          href="/portal/setup"
          className="underline-offset-2 hover:underline"
        >
          Setup hub
        </Link>
      </footer>
    </div>
  );
}
