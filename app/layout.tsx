import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/posthog-provider";
import { Toaster } from "@/components/ui/sonner";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { portalConfig } from "@/lib/portal-config";
import { BRAND_NAME } from "@/lib/brand";

// DECISION: Inter Variable with OpenType features cv01 + ss03 drives the
// Linear-inspired UI system. JetBrains Mono stands in for Berkeley Mono (a
// paid font) for labels, tags, and code. Both loaded once at the root and
// exposed as CSS variables to every component.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export const metadata: Metadata = {
  title: `${BRAND_NAME}, managed marketing for real estate operators`,
  description:
    "Custom marketing stack for real estate operators: website, live listings, AI chatbot, ad pixel, ad creative. Managed by us. Launched in two weeks.",
  metadataBase: new URL(portalConfig.appUrl),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: `${BRAND_NAME}, managed marketing for real estate operators`,
    description:
      "Custom marketing stack for real estate operators. Managed by us. Launched in two weeks.",
    type: "website",
    siteName: BRAND_NAME,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME}, managed marketing for real estate operators`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME}, managed marketing for real estate operators`,
    description:
      "Custom marketing stack for real estate operators. Managed by us.",
    images: ["/og-image.png"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: portalConfig.brandName,
  url: portalConfig.appUrl,
  description:
    `${portalConfig.brandName} is a managed marketing SaaS platform for real estate operators.`,
  contactPoint: {
    "@type": "ContactPoint",
    email: portalConfig.contactEmail,
    contactType: "sales",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // DECISION: Always wrap with ClerkProvider so components deeper in the tree
  // that use Clerk hooks (e.g., PostHogUserIdentifier, auth-aware navigation)
  // can prerender safely. Clerk handles missing env keys with a warning rather
  // than a crash. Wholesail conditionally wrapped; that broke `/not-found`
  // prerender when Clerk env vars weren't set.
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`scroll-smooth ${inter.variable} ${jetbrainsMono.variable}`}
      >
        <body
          className="antialiased"
          style={{
            backgroundColor: "#FFFFFF",
            color: "#393C41",
            fontFamily: "var(--font-sans)",
          }}
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationSchema),
            }}
          />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-cream focus:font-mono focus:text-sm"
          >
            Skip to main content
          </a>
          <PostHogProvider>{children}</PostHogProvider>
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
