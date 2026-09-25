import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { groupModulesByCategory } from "@/lib/marketplace/catalog";
import { MarketplaceClient } from "@/components/portal/marketplace/marketplace-client";

export const metadata: Metadata = {
  title: "Marketplace · LeaseStack",
  description:
    "Activate add-on modules — visitor pixel, AI chatbot, SEO, ads, creative — all free during your trial (excluding Pro add-ons).",
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/marketplace — the post-signup landing page.
//
// Renders the catalog of modules grouped by category. Card behaviour
// depends on `kind`:
//   toggle   — activatable Boolean. Free during trial, Stripe post-trial.
//   included — always-on. Renders with "Included" pill + "Use it" link.
//   addon    — paid Stripe SKU (Reputation Pro, White-label). Routes to
//              billing for checkout.
//   coming   — coming soon. Greyed out, "Notify me", no activation.
// ---------------------------------------------------------------------------

export default async function MarketplacePage() {
  const scope = await requireScope();

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      modulePixel: true,
      moduleChatbot: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      moduleSEO: true,
      moduleEmail: true,
      moduleOutboundEmail: true,
      moduleReferrals: true,
      moduleCreativeStudio: true,
      moduleLeadCapture: true,
      modulePopups: true,
      // Only real entitlement flag for a "Pro Add-ons" catalog entry today
      // (Reputation Pro has none — see lib/marketplace/catalog.ts). Needed
      // so the White-label tile can show Active instead of always
      // "Request setup" once ops flips it on for an org.
      whiteLabel: true,
    },
  });

  if (!org) notFound();

  const isTrialing =
    org.subscriptionStatus === "TRIALING" || org.subscriptionStatus === null;

  const daysLeft = org.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(org.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  // Snapshot of which modules are currently on — keyed by catalog `key`,
  // not just toggleable ones. Concierge entries (moduleSEO) use the same
  // org.module<X> boolean a toggle would, they just can't be flipped by the
  // customer; the tile still needs to know it's on so status + CTA agree
  // ("Active" + "Open", not "Request setup" for a module ops already turned
  // on). The client mirrors this in local state so toggles feel instant.
  //
  // moduleWebsite is excluded on purpose: prisma/schema.prisma declares it
  // `@default(true)`, so it's true for every org including brand-new trials
  // and BYO-site orgs — it's schema noise, not a real "ops turned this on"
  // signal. Feeding it here would show every org a false "Hosted Marketing
  // Site: Active" tile (review finding, 2026-09-25). There's no reliable
  // active signal for this tile today; it always renders "Not active".
  const initialEnabled: Record<string, boolean> = {
    modulePixel: org.modulePixel,
    moduleChatbot: org.moduleChatbot,
    moduleGoogleAds: org.moduleGoogleAds,
    moduleMetaAds: org.moduleMetaAds,
    moduleSEO: org.moduleSEO,
    moduleEmail: org.moduleEmail,
    moduleOutboundEmail: org.moduleOutboundEmail,
    moduleReferrals: org.moduleReferrals,
    moduleCreativeStudio: org.moduleCreativeStudio,
    moduleLeadCapture: org.moduleLeadCapture,
    modulePopups: org.modulePopups,
    ls_addon_white_label: org.whiteLabel,
  };

  const grouped = groupModulesByCategory();

  // Toggleable keys only — the client uses this for "Unlock everything".
  // Derived from the same grouped/rendered set so the storefront filter
  // (hidden + readiness gate) and the bulk action can't drift: a ready:false
  // module here would 400 at the toggle API and wedge "Unlock everything".
  const toggleableKeys = grouped
    .flatMap((g) => g.modules)
    .filter((e) => e.kind === "toggle")
    .map((e) => e.key);

  return (
    <MarketplaceClient
      orgName={org.name}
      isTrialing={isTrialing}
      trialDaysLeft={daysLeft}
      initialEnabled={initialEnabled}
      grouped={grouped.map((g) => ({
        category: g.category,
        modules: g.modules.map((m) => ({
          key: m.key,
          kind: m.kind,
          slug: m.slug,
          name: m.name,
          tagline: m.tagline,
          bullets: m.bullets,
          monthlyPriceCents: m.monthlyPriceCents,
          setupHref: m.setupHref,
          activeHref: activeHrefFor(m.key),
          popular: m.popular ?? false,
          setupEffort: m.setupEffort ?? null,
          // We can't pass icons across the server/client boundary directly,
          // so map to a lucide string name and let the client resolve.
          iconName: iconNameFor(m.key),
          brandLogoKeys: m.brandLogoKeys ?? [],
        })),
      }))}
      allToggleableKeys={toggleableKeys}
    />
  );
}

// Where a concierge/addon tile's "Open" CTA routes once the org already has
// it active (org.module<X> / org.whiteLabel is true). Mirrors the routes
// components/portal/portal-nav.tsx already uses for the same flags, so the
// marketplace "Open" button lands on the same page the nav would. null =
// no dedicated page yet — falls back to setupHref (Reputation Pro has no
// active-state page or entitlement flag at all; see lib/marketplace/catalog.ts).
// moduleWebsite has no case here on purpose — see the initialEnabled comment
// above; it never reports "active" so its Open route is unreachable today.
function activeHrefFor(key: string): string | null {
  switch (key) {
    case "moduleSEO":
      return "/portal/seo";
    case "ls_addon_white_label":
      return "/portal/settings/white-label";
    default:
      return null;
  }
}

// Keep this in sync with components/portal/marketplace/marketplace-client.tsx
// — the client maps these names back to the actual lucide-react components.
function iconNameFor(key: string): string {
  switch (key) {
    case "modulePixel":
      return "Eye";
    case "moduleChatbot":
      return "Bot";
    case "moduleSEO":
      return "TrendingUp";
    case "moduleGoogleAds":
    case "moduleMetaAds":
      return "BarChart3";
    case "moduleEmail":
      return "Mail";
    case "moduleOutboundEmail":
      return "Send";
    case "moduleCreativeStudio":
      return "Brush";
    case "moduleReferrals":
      return "Share2";
    case "moduleWebsite":
      return "Globe";
    case "moduleLeadCapture":
      return "Users";
    case "reputation-monitoring":
      return "Star";
    case "ls_addon_reputation_pro":
    case "ls_addon_white_label":
      return "Sparkles";
    default:
      return "Sparkles";
  }
}
