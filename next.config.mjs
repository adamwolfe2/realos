import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.wholesailhub.com https://js.stripe.com https://*.sentry.io https://*.sentry-cdn.com https://*.posthog.com https://*.vercel-scripts.com https://*.vercel-insights.com https://assets.cal.com",
      "style-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.wholesailhub.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https://*.clerk.accounts.dev https://clerk.wholesailhub.com https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.posthog.com https://*.vercel-insights.com https://cal.com https://app.cal.com https://*.neon.tech",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.clerk.accounts.dev https://clerk.wholesailhub.com https://*.stripe.com",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@radix-ui/react-icons",
      "@sentry/nextjs",
      "framer-motion",
      "posthog-js",
      "cmdk",
      "@clerk/nextjs",
      "sonner",
      "zod",
    ],
  },
  async redirects() {
    // These TBGC template pages were carried over from the distribution portal
    // template and have luxury food distributor content that doesn't belong on
    // wholesailhub.com (a B2B software platform). Redirect to homepage.
    const tbgcPages = [
      "/journal",
      "/journal/:slug*",
      "/provenance",
      "/provenance/:slug*",
      "/social",
      "/guide",
      "/seasonal",
      "/drops",
      "/drops/:slug*",
      "/partner",
      "/apply",
      "/apply/:slug*",
    ];
    return tbgcPages.map((source) => ({
      source,
      destination: "/",
      permanent: false,
    }));
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|woff2|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
