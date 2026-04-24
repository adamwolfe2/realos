import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
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
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">Site builder</h1>
        <p className="text-sm text-muted-foreground">
          This workspace is on a plan without the managed website module,
          or you selected bring-your-own-site during onboarding. Ping your
          account manager if that's not right.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Site builder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit your live marketing site. Saving publishes immediately and
          revalidates every tenant site route.
        </p>
      </header>
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
