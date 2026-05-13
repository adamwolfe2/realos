import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { groupModulesByCategory, MARKETPLACE_MODULES } from "@/lib/marketplace/catalog";
import { MarketplaceClient } from "@/components/portal/marketplace/marketplace-client";

export const metadata: Metadata = {
  title: "Marketplace · LeaseStack",
  description:
    "Activate add-on modules — visitor pixel, AI chatbot, SEO, ads, email — all free during your trial.",
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/marketplace — the new post-signup landing page.
//
// Renders the catalog of add-on modules grouped by category. Trial users
// see "FREE during trial" badges on every card and an "Unlock all" CTA
// that flips every Boolean in one shot. Post-trial users see real prices
// and Activate buttons that route into Stripe Checkout.
//
// Activated modules appear with a green "Activated" pill and a "Set up"
// link instead of "Add to plan", so re-visits are useful even after the
// initial unlock pass.
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

  // Snapshot of which modules are currently on. The client component
  // mirrors this in local state so toggles feel instant.
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
  };

  const grouped = groupModulesByCategory();

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
          slug: m.slug,
          name: m.name,
          tagline: m.tagline,
          bullets: m.bullets,
          monthlyPriceCents: m.monthlyPriceCents,
          setupHref: m.setupHref,
          popular: m.popular ?? false,
          // We can't pass icons across the server/client boundary directly,
          // so map to the lucide string name and let the client resolve.
          iconName: iconNameFor(m.key),
        })),
      }))}
      allModuleKeys={MARKETPLACE_MODULES.map((m) => m.key)}
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
    default:
      return "Sparkles";
  }
}
