import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/brand";
import { BLOG_POSTS } from "@/lib/copy/blog";
import { prisma } from "@/lib/db";
import { NeighborhoodPageStatus } from "@prisma/client";

const BASE_URL = getSiteUrl();

// ---------------------------------------------------------------------------
// Platform sitemap. Enumerates every public marketing route so Google +
// ChatGPT/Perplexity can index the whole offer. Tenant marketing sites
// ship their own sitemaps via the tenant renderer in Sprint 12 follow-up.
//
// Neighborhood landing pages: we additionally surface every PUBLISHED
// NeighborhoodPage on the platform sitemap, keyed by the tenant's
// primary hostname. This gives Google a single discovery point while
// per-tenant sitemaps (when they ship) carry the same URLs again at the
// tenant root. AI engines crawling the marketing site reach these the
// same way.
// ---------------------------------------------------------------------------

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: Array<{
    url: string;
    lastModified: Date;
    changeFrequency:
      | "always"
      | "hourly"
      | "daily"
      | "weekly"
      | "monthly"
      | "yearly"
      | "never";
    priority: number;
  }> = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/demo`, lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/manifesto`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    // Verticals
    { url: `${BASE_URL}/residential`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/student-housing`, lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE_URL}/multifamily`, lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE_URL}/senior-living`, lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE_URL}/commercial`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Features
    { url: `${BASE_URL}/features/pixel`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/features/chatbot`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/features/seo-aeo`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE_URL}/features/ads`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    // Legal
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // Onboarding
    { url: `${BASE_URL}/onboarding`, lastModified: now, changeFrequency: "monthly", priority: 0.95 },
  ];

  for (const post of BLOG_POSTS) {
    routes.push({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  // Tenant neighborhood landing pages. We resolve each page's host by
  // joining against the tenant's primary domain binding (falling back to
  // the platform-domain subdomain `<slug>.<platform>`). Wrapped in
  // try/catch so a DB hiccup never poisons the marketing-site sitemap.
  try {
    const platformDomain =
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ??
      process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split(
        "/",
      )[0] ??
      "leasestack.co";
    const pages = await prisma.neighborhoodPage.findMany({
      where: { status: NeighborhoodPageStatus.PUBLISHED },
      select: {
        slug: true,
        updatedAt: true,
        org: {
          select: {
            slug: true,
            domains: {
              orderBy: { isPrimary: "desc" },
              take: 1,
              select: { hostname: true },
            },
          },
        },
      },
      take: 10000,
    });
    for (const p of pages) {
      const host =
        p.org.domains[0]?.hostname ?? `${p.org.slug}.${platformDomain}`;
      routes.push({
        url: `https://${host}/n/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error("[sitemap] neighborhood page enumeration failed:", err);
  }

  return routes;
}
