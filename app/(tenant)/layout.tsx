import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { readTenantHeaders } from "@/lib/tenancy/resolve";

// ---------------------------------------------------------------------------
// Route-group layout for the tenant marketing surface.
// Requires middleware to have set the tenant headers; direct hits to
// /tenant-site/... from the platform hostname 404 here.
//
// TODO(Sprint 07): pull TenantSiteConfig into context, expose brand tokens
// (logo, primaryColor, font) as CSS variables, render navbar + footer.
// ---------------------------------------------------------------------------

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId } = readTenantHeaders(await headers());
  if (!orgId) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { tenantSiteConfig: true },
  });
  if (!org) notFound();

  return (
    <div
      data-tenant-slug={org.slug}
      style={{
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ...({
          "--tenant-primary": org.primaryColor ?? "#111827",
          "--tenant-secondary": org.secondaryColor ?? "#6b7280",
        } as React.CSSProperties),
      }}
    >
      {children}
    </div>
  );
}
