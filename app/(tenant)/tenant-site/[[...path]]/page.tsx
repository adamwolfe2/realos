import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { readTenantHeaders } from "@/lib/tenancy/resolve";

// ---------------------------------------------------------------------------
// Tenant catch-all renderer.
// Reached via middleware rewrite: {tenantHost}/foo -> /tenant-site/foo.
// Direct hits (e.g. realos.dev/tenant-site/foo) have no tenant headers and
// 404 here.
//
// TODO(Sprint 07): real tenant marketing site pages: home, floor plans,
// amenities, gallery, location, parents/FAQ, contact. Dispatch off the path
// segments and pull live listings from AppFolio via Property/Listing rows.
// ---------------------------------------------------------------------------

export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { orgId, slug, hostname } = readTenantHeaders(await headers());
  if (!orgId) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { tenantSiteConfig: true, properties: { take: 10 } },
  });
  if (!org) notFound();

  const resolved = await params;
  const segments = resolved.path ?? [];
  const pagePath = segments.length === 0 ? "home" : segments.join("/");

  return (
    <main className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs tracking-widest uppercase opacity-60 mb-2">
          Tenant site, Sprint 07 renders this
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6">
          {org.tenantSiteConfig?.heroHeadline ?? org.name}
        </h1>
        {org.tenantSiteConfig?.heroSubheadline ? (
          <p className="text-lg opacity-80 mb-8">
            {org.tenantSiteConfig.heroSubheadline}
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-y-2 text-sm opacity-80">
          <dt className="opacity-60">Hostname</dt>
          <dd>{hostname}</dd>
          <dt className="opacity-60">Slug</dt>
          <dd>{slug}</dd>
          <dt className="opacity-60">Page path</dt>
          <dd>/{pagePath}</dd>
          <dt className="opacity-60">Property type</dt>
          <dd>{org.propertyType}</dd>
          <dt className="opacity-60">Properties</dt>
          <dd>{org.properties.length}</dd>
        </dl>
      </div>
    </main>
  );
}
