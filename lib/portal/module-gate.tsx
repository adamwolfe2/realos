import * as React from "react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";

// ---------------------------------------------------------------------------
// Module gate — shared helper for portal pages that hang off a
// `Organization.module*` boolean. Pages call `assertModuleEnabled` at the
// top, and either get a `null` (proceed normally) or a rendered
// "module not active" surface that they should return directly.
//
// We deliberately render an in-page pitch surface instead of
// notFound() / redirect() because:
//   1) Operators land here via the sidebar or a saved link and a 404
//      is hostile UX when the page is intentionally hidden.
//   2) The same EmptyState surface is what the agency uses to upsell
//      add-ons in-product — keeping it consistent across modules.
//
// To add a new module gate, extend the union in `PortalModuleKey` and
// add a row to MODULE_COPY. The admin toggle list in
// `lib/actions/admin-modules.ts` should stay in sync.
// ---------------------------------------------------------------------------

export type PortalModuleKey =
  | "moduleWebsite"
  | "moduleLeadCapture"
  | "modulePixel"
  | "moduleChatbot"
  | "moduleGoogleAds"
  | "moduleMetaAds"
  | "moduleSEO"
  | "moduleEmail"
  | "moduleOutboundEmail"
  | "moduleReferrals"
  | "moduleCreativeStudio"
  | "modulePopups"
  | "moduleVault"
  | "moduleReputation"
  | "moduleInsights"
  | "moduleAttribution"
  | "moduleResidents"
  | "moduleTours"
  | "moduleConversations";

type ModuleCopy = {
  eyebrow?: string;
  title: string;
  pageTitle: string;
  body: string;
};

const MODULE_COPY: Record<PortalModuleKey, ModuleCopy> = {
  moduleWebsite: {
    pageTitle: "Website",
    title: "Website module not active",
    body: "The hosted marketing site is part of the Website module. Activate it from the Marketplace, free during your trial.",
  },
  moduleLeadCapture: {
    pageTitle: "Leads",
    title: "Lead capture module not active",
    body: "Public lead capture forms are part of the Lead Capture module. Activate it from the Marketplace, free during your trial.",
  },
  modulePixel: {
    pageTitle: "Visitors",
    title: "Visitor pixel not active",
    body: "The site visitor identity pixel is a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleChatbot: {
    pageTitle: "Chatbot",
    title: "Chatbot module not active",
    body: "The on-site AI leasing assistant is a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleGoogleAds: {
    pageTitle: "Google Ads",
    title: "Google Ads module not active",
    body: "Google Ads management is a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleMetaAds: {
    pageTitle: "Meta Ads",
    title: "Meta Ads module not active",
    body: "Meta Ads management is a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleSEO: {
    pageTitle: "SEO",
    title: "SEO module not active",
    body: "Local + neighborhood SEO is a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleEmail: {
    pageTitle: "Email",
    title: "Email nurture module not active",
    body: "Email nurture sequences are a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleOutboundEmail: {
    pageTitle: "Outbound email",
    title: "Outbound email module not active",
    body: "Outbound email campaigns are a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleReferrals: {
    eyebrow: "Resident program",
    pageTitle: "Referrals",
    title: "Referrals module not active",
    body: "The resident referral program lets current residents share a unique link that tags incoming leads as referrals. Activate it from the Marketplace, free during your trial.",
  },
  moduleCreativeStudio: {
    pageTitle: "Creative studio",
    title: "Creative studio not active",
    body: "Creative studio lets you file ad, email, and flyer requests and review deliveries. Activate it from the Marketplace, free during your trial.",
  },
  modulePopups: {
    pageTitle: "Popups",
    title: "Popups module not active",
    body: "Embeddable promo, referral, and discount popups are a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleVault: {
    pageTitle: "Vault",
    title: "Vault module not active",
    body: "The encrypted credentials vault is a paid add-on. Activate it from the Marketplace, free during your trial.",
  },
  moduleReputation: {
    pageTitle: "Reputation",
    title: "Reputation module not active",
    body: "Reputation aggregates reviews across Google, Apartments.com, and Yelp into a single inbox with sentiment scoring and reply workflows. Activate it from the Marketplace, free during your trial.",
  },
  moduleInsights: {
    pageTitle: "Insights",
    title: "Insights module not active",
    body: "Insights, the morning briefing, and weekly intelligence reports run on the same signal pipeline. Activate it from the Marketplace, free during your trial.",
  },
  moduleAttribution: {
    pageTitle: "Attribution",
    title: "Attribution module not active",
    body: "Multi-touch attribution stitches every lead back to the source channel, campaign, and creative. Activate it from the Marketplace, free during your trial.",
  },
  moduleResidents: {
    eyebrow: "Operations",
    pageTitle: "Residents",
    title: "Resident operations not active",
    body: "Residents, renewals, work orders, and applications hang off the AppFolio sync. Activate it from the Marketplace, free during your trial.",
  },
  moduleTours: {
    pageTitle: "Tours",
    title: "Tours module not active",
    body: "Tour bookings collected from the public booking form or API-key ingest. Activate it from the Marketplace, free during your trial.",
  },
  moduleConversations: {
    pageTitle: "Conversations",
    title: "Conversations module not active",
    body: "The unified conversation inbox surfaces every chatbot, SMS, and email thread. Activate it from the Marketplace, free during your trial.",
  },
};

/**
 * Server-side module gate. Returns null when the module is enabled
 * (page should render normally), or a JSX surface the page must
 * return directly. Used at the top of every portal page that hangs
 * off a module boolean.
 */
export async function requireModule(
  module: PortalModuleKey,
): Promise<React.ReactElement | null> {
  const scope = await requireScope();
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: { [module]: true } as Record<string, true>,
  });
  const enabled = !!(org as Record<string, unknown> | null)?.[module];
  if (enabled) return null;
  return <ModuleInactiveSurface module={module} />;
}

/** Bare check (no rendering). Used by callers that already loaded the org. */
export function isModuleEnabled(
  org: Record<string, unknown> | null,
  module: PortalModuleKey,
): boolean {
  return !!org?.[module];
}

function ModuleInactiveSurface({ module }: { module: PortalModuleKey }) {
  const copy = MODULE_COPY[module];
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={copy.eyebrow} title={copy.pageTitle} />
      <EmptyState
        title={copy.title}
        body={copy.body}
        action={{ label: "Open Marketplace", href: "/portal/marketplace" }}
      />
    </div>
  );
}
