import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { SiteBuilderForm } from "./site-builder-form";

export const metadata: Metadata = { title: "Site builder" };
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
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader
          title="Site builder"
          description="This workspace is on a plan without the managed website module, or you selected bring-your-own-site during onboarding. Ping your account manager if that's not right."
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Site builder"
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
