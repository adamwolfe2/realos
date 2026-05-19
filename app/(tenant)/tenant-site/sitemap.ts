import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getTenantFromHeaders, tenantPrimaryHost } from "@/lib/tenancy/tenant-context";
import { NeighborhoodPageStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Per-tenant sitemap. Served at each tenant hostname's /sitemap.xml (the
// hostname-rewrite branch in middleware.ts maps it into this file). Lists
// the tenant's standard marketing pages plus every PUBLISHED neighborhood
// landing page.
// ---------------------------------------------------------------------------

const DEFAULT_PAGES = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/floor-plans", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/amenities", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/gallery", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/location", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/apply", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/schedule", priority: 0.9, changeFrequency: "monthly" as const },
];

export default async function tenantSitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return [];
  const host = tenantPrimaryHost(tenant);
  const base = `https://${host}`;

  const now = new Date();
  const routes: MetadataRoute.Sitemap = DEFAULT_PAGES.map((p) => ({
    url: `${base}${p.path === "/" ? "" : p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  try {
    const pages = await prisma.neighborhoodPage.findMany({
      where: { orgId: tenant.id, status: NeighborhoodPageStatus.PUBLISHED },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    });
    for (const p of pages) {
      routes.push({
        url: `${base}/n/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  } catch (err) {
    console.error("[tenant-sitemap] enumeration failed:", err);
  }

  return routes;
}
