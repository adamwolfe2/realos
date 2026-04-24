import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/brand";
import { BLOG_POSTS } from "@/lib/copy/blog";

const BASE_URL = getSiteUrl();

// ---------------------------------------------------------------------------
// Platform sitemap. Enumerates every public marketing route so Google +
// ChatGPT/Perplexity can index the whole offer. Tenant marketing sites
// ship their own sitemaps via the tenant renderer in Sprint 12 follow-up.
// ---------------------------------------------------------------------------

export default function sitemap(): MetadataRoute.Sitemap {
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

  return routes;
}
