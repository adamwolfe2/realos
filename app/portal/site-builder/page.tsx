import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { SiteBuilderForm } from "./site-builder-form";

export const metadata: Metadata = { title: "Site Engine · Builder" };
export const dynamic = "force-dynamic";

export default async function SiteBuilderPage() {
  const scope = await requireScope();

  const [org, existingConfig, primaryBinding] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        moduleWebsite: true,
        modulePixel: true,
        bringYourOwnSite: true,
      },
    }),
    prisma.tenantSiteConfig.findUnique({ where: { orgId: scope.orgId } }),
    prisma.domainBinding.findFirst({
      where: { orgId: scope.orgId, isPrimary: true },
      select: { hostname: true },
    }),
  ]);

  if (!org?.moduleWebsite || org.bringYourOwnSite) {
    const byo = Boolean(org?.bringYourOwnSite);
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader
          title="Site Engine · Builder"
          description="Edit and publish your LeaseStack-managed marketing site."
        />
        <EmptyState
          icon={<Globe className="h-4 w-4" aria-hidden="true" />}
          title={
            byo
              ? "This workspace brings its own website"
              : "The managed website module isn't on this plan"
          }
          body={
            byo
              ? "You selected bring-your-own-site during onboarding, so the builder is switched off. Manage the change from your workspace settings, or review plans if you'd like LeaseStack to host and manage your site."
              : "Upgrade to a plan that includes the managed website module to design, publish, and host your marketing site from here."
          }
          action={{ label: "View plans & upgrade", href: "/portal/billing" }}
          secondary={{ label: "Workspace settings", href: "/portal/settings" }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Site Engine · Builder"
        description="Edit your live marketing site. Saving publishes immediately and revalidates every tenant site route."
      />
      <SiteBuilderForm
        orgName={org.name}
        orgSlug={org.slug}
        primaryDomain={primaryBinding?.hostname ?? null}
        modulePixel={org.modulePixel}
        initial={existingConfig}
      />
    </div>
  );
}
