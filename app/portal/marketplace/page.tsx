import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import {
  groupModulesByCategory,
  MARKETPLACE_ENTRIES,
} from "@/lib/marketplace/catalog";
import { MarketplaceClient } from "@/components/portal/marketplace/marketplace-client";

export const metadata: Metadata = {
  title: "Marketplace · LeaseStack",
  description:
    "Activate add-on modules — visitor pixel, AI chatbot, SEO, ads, creative — all free during your trial.",
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
      moduleWebsite: true,
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

  // Snapshot of which toggleable modules are currently on. The client
  // mirrors this in local state so toggles feel instant. Included +
  // addon entries don't need a flag — they're rendered from the catalog
  // kind directly.
  const initialEnabled: Record<string, boolean> = {
    moduleWebsite: org.moduleWebsite,
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
  };

  const grouped = groupModulesByCategory();

  // Toggleable keys only — the client uses this for "Unlock everything".
  const toggleableKeys = MARKETPLACE_ENTRIES.filter(
    (e) => e.kind === "toggle",
  ).map((e) => e.key);

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
