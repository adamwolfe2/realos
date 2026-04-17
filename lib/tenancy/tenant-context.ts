import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { readTenantHeaders } from "./resolve";

// Request-memoized tenant loader. Every tenant page reaches for the same
// Organization, so we cache the DB read for the lifetime of the request.
//
// Middleware sets x-tenant-org-id; layout.tsx + every page.tsx in the
// tenant route group calls this helper and 404s when it returns null.

export const getTenantFromHeaders = cache(async () => {
  const { orgId } = readTenantHeaders(await headers());
  if (!orgId) return null;

  const tenant = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      tenantSiteConfig: true,
      domains: true,
      properties: {
        orderBy: { updatedAt: "desc" },
        include: {
          listings: {
            where: { isAvailable: true },
            orderBy: [{ priceCents: "asc" }, { unitType: "asc" }],
          },
        },
      },
    },
  });
  return tenant;
});

export type TenantWithSite = NonNullable<
  Awaited<ReturnType<typeof getTenantFromHeaders>>
>;

export function tenantPrimaryHost(tenant: TenantWithSite): string {
  const custom = tenant.domains.find((d) => d.isPrimary) ?? tenant.domains[0];
  if (custom) return custom.hostname;
  const platform =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split("/")[0];
  return `${tenant.slug}.${platform ?? "realos.dev"}`;
}
