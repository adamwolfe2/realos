import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/posthog-provider";
import { Toaster } from "@/components/ui/sonner";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { portalConfig } from "@/lib/portal-config";
import { BRAND_NAME } from "@/lib/brand";

// DECISION: Fraunces is our open-source stand-in for Anthropic Serif
// (Claude's custom headline face). Inter covers Anthropic Sans (UI + body).
// JetBrains Mono replaces Anthropic Mono for code and small labels.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  axes: ["opsz"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
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
  themeColor: "#F5F5F5",
};

export const metadata: Metadata = {
  title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
  description:
    "LeaseStack tells real estate operators exactly what their digital marketing is doing, and exactly what to do about it. One platform, every signal, on your domain.",
  metadataBase: new URL(portalConfig.appUrl),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.svg",
    other: [{ rel: "mask-icon", url: "/favicon.svg", color: "#2563EB" }],
  },
  openGraph: {
    title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
    description:
      "Your leasing data. Working for you. Every lead source, every channel, every conversion: tracked, aggregated, and acted on.",
    type: "website",
    siteName: BRAND_NAME,
    images: [
      {
        url: "/logos/social-background.png",
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME}: Leasing intelligence for real estate operators`,
    description:
      "Your leasing data. Working for you.",
    images: ["/logos/social-background.png"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: portalConfig.brandName,
  url: portalConfig.appUrl,
  description:
    `${portalConfig.brandName} is a leasing intelligence platform for real estate operators. It tracks every marketing signal, attributes spend to lease signings, and tells operators what to do next.`,
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
  // than a crash. Conditional wrapping broke `/not-found` prerender when
  // Clerk env vars weren't set.
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`scroll-smooth ${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      >
        <body
          className="antialiased bg-background text-foreground"
          style={{
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
