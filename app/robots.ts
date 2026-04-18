import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/get-site-url";

const SITE_URL = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/portal/",
          "/api/",
          "/sign-in/",
          "/sign-up/",
          "/auth/",
          "/tenant-site/",
          "/unsub",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
