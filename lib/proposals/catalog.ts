import "server-only";
import { prisma } from "@/lib/db";
import type { ProposalCatalogItem } from "@prisma/client";
import { STRIPE_PRICE_IDS } from "@/lib/billing/price-ids.generated";

// ---------------------------------------------------------------------------
// Proposal builder catalog seed.
//
// The proposal builder draws its line-item picker from `ProposalCatalogItem`
// rows. To keep the agency tool aligned with the public pricing page (the
// source of truth for what we sell), we maintain a TypeScript array literal
// of the canonical SKUs here and `ensureCatalogSeeded()` upserts them by
// `slug`. Safe to run on app startup, migration, or as a one-shot CLI.
//
// Operator UX:
//   - Tier slugs:  `tier-<id>`        (foundation | growth | scale | enterprise)
//   - Addon slugs: `addon-<kebab>`    (addon-reputation-pro, addon-keyword-trends, …)
//
// Pricing rules:
//   - Every `defaultPriceCents` is an INTEGER in USD cents.
//   - `cadence` MONTHLY for recurring rows, null for one-time (Website Build).
//   - `stripePriceIdMonthly` / `stripePriceIdAnnual` populated when a
//     stable Stripe Price exists (from `lib/billing/price-ids.generated.ts`);
//     null otherwise. The builder always falls back to inline `price_data`
//     so a missing Stripe ID does NOT block sending — it just means a
//     fresh disposable Price gets created on Checkout.
//   - Foundation: $0 (free trial) — kept active so operators can include it
//     in a proposal as a "trial line" or upsell teaser.
//   - Enterprise: stored with price 0 and `active: false`. Surfaces in the
//     catalog admin as "price-on-request"; operators override per-proposal.
// ---------------------------------------------------------------------------

export type ProposalCatalogSeed = {
  slug: string;
  kind: "TIER" | "ADDON";
  label: string;
  description: string;
  defaultPriceCents: number;
  cadence: "MONTHLY" | "ANNUAL" | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  active: boolean;
  sortOrder: number;
};

// Helper: look up a generated Stripe Price ID by lookup_key, returning null
// if absent. Kept in-module so the seed list reads cleanly.
function priceId(
  lookupKey: keyof typeof STRIPE_PRICE_IDS | (string & {}),
): string | null {
  return (STRIPE_PRICE_IDS as Record<string, string | undefined>)[lookupKey] ?? null;
}

export const PROPOSAL_CATALOG: ReadonlyArray<ProposalCatalogSeed> = [
  // ── Tiers ────────────────────────────────────────────────────────────
  {
    slug: "tier-foundation",
    kind: "TIER",
    label: "Foundation",
    description:
      "Free 14-day trial. Connect your PMS, ad accounts, and site so LeaseStack can read what your marketing is actually doing. Includes the AI leasing chatbot trained on your listings and reputation monitoring across Google, Reddit, and the open web.",
    defaultPriceCents: 0,
    cadence: "MONTHLY",
    stripePriceIdMonthly: priceId("ls_foundation_monthly_v1"),
    stripePriceIdAnnual: priceId("ls_foundation_annual_v1"),
    active: true,
    sortOrder: 10,
  },
  {
    slug: "tier-growth",
    kind: "TIER",
    label: "Growth",
    description:
      "Replace your retainer. Visitor pixel with 5,000 identified visitors per month, Google and Meta spend recommendations, AI chatbot at 5,000 conversations per month, source-to-lease attribution with GSC and GA4, operator-written weekly read on every channel.",
    defaultPriceCents: 89900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: priceId("ls_growth_monthly_v1"),
    stripePriceIdAnnual: priceId("ls_growth_annual_v1"),
    active: true,
    sortOrder: 20,
  },
  {
    slug: "tier-scale",
    kind: "TIER",
    label: "Scale",
    description:
      "Per-property pricing with a portfolio rollup. Visitor pixel at 25,000 identified visitors per month, audience sync to Meta, Google, and TikTok, unlimited AI chatbot, dedicated operator success contact, scheduled reports formatted for asset reviews.",
    defaultPriceCents: 149900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: priceId("ls_scale_monthly_v1"),
    stripePriceIdAnnual: priceId("ls_scale_annual_v1"),
    active: true,
    sortOrder: 30,
  },
  {
    slug: "tier-enterprise",
    kind: "TIER",
    label: "Enterprise",
    description:
      "Custom integrations and volume pricing for multi-brand owners. Includes white-label workspace, custom PMS integrations, SSO + SCIM, custom data retention, and multi-year terms. Pricing set per deal — override the line item with the negotiated number before sending.",
    defaultPriceCents: 0,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    // Kept active so it shows in the picker; operator must enter a price
    // when adding to a proposal. The builder UI surfaces a warning when
    // a TIER line is added with a 0 unit price.
    active: true,
    sortOrder: 40,
  },

  // ── Add-ons (capability, recurring) ──────────────────────────────────
  {
    slug: "addon-reputation-pro",
    kind: "ADDON",
    label: "Reputation Pro",
    description:
      "Deeper ApartmentRatings crawl, Google Business reply automation, and sentiment trending across every source. Flags negative mentions in under 6 hours.",
    defaultPriceCents: 9900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: priceId("ls_reputation_pro_monthly_v1"),
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 110,
  },
  {
    slug: "addon-keyword-trends",
    kind: "ADDON",
    label: "Keyword Trends",
    description:
      "Weekly competitor rank tracking across your top 200 keywords. What people are searching for, who's winning, where you're closest to top-3.",
    defaultPriceCents: 14900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 120,
  },
  {
    slug: "addon-aeo-boost",
    kind: "ADDON",
    label: "AEO Boost",
    description:
      "Daily AI-search scans across Claude, ChatGPT, Gemini, and Perplexity. Per-prompt citation history plus Content Drafter for the gaps. Standard plans run weekly.",
    defaultPriceCents: 19900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 130,
  },
  {
    slug: "addon-audience-sync",
    kind: "ADDON",
    label: "Audience Sync",
    description:
      "Push identified visitors to Meta, Google, and TikTok ad audiences as custom audiences or lookalike seeds. Refreshes nightly.",
    defaultPriceCents: 12900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 140,
  },
  {
    slug: "addon-outbound-email-engine",
    kind: "ADDON",
    label: "Outbound Email Engine",
    description:
      "Trigger drip sequences off identified visitors and chatbot drop-offs. Templates, deliverability monitoring, and a 3,000-send cap included.",
    defaultPriceCents: 17900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 150,
  },
  {
    slug: "addon-chatbot-pro",
    kind: "ADDON",
    label: "Chatbot Pro",
    description:
      "Voice + SMS handoff, multi-language support, deeper escalation routing, and the unlimited-conversation cap. Plays alongside any tier.",
    defaultPriceCents: 14900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 160,
  },
  {
    slug: "addon-cursive-pixel-pro",
    kind: "ADDON",
    label: "Cursive Pixel Pro",
    description:
      "Higher visitor-resolution tier with enriched company + role data, longer history retention, and priority pipeline for ad-audience export.",
    defaultPriceCents: 19900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 170,
  },
  {
    slug: "addon-insights-pro",
    kind: "ADDON",
    label: "Insights Pro",
    description:
      "Operator-written insight digest, custom KPI tracking, board-ready summaries, and the scheduled-report builder. Powers the Insights and Briefing surfaces.",
    defaultPriceCents: 14900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 180,
  },
  {
    slug: "addon-integrations-pro",
    kind: "ADDON",
    label: "Integrations Pro",
    description:
      "AppFolio, RealPage, Yardi, HubSpot, and Salesforce two-way sync. Lead push, lease pull, audit log, and Slack / Teams notifications.",
    defaultPriceCents: 19900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 190,
  },
  {
    slug: "addon-custom-domain",
    kind: "ADDON",
    label: "Custom domain",
    description:
      "Bring your own domain for the operator dashboard and outbound emails (portal.yourbrand.com). Includes SSL plus SPF / DKIM setup.",
    defaultPriceCents: 4900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 200,
  },
  {
    slug: "addon-white-label",
    kind: "ADDON",
    label: "White-label workspace",
    description:
      "Removes LeaseStack branding from the operator dashboard, tenant portal, and outbound emails. For owners running multiple brands under one entity.",
    defaultPriceCents: 49900,
    cadence: "MONTHLY",
    stripePriceIdMonthly: priceId("ls_white_label_monthly_v1"),
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 210,
  },

  // ── Add-ons (one-time delivery) ─────────────────────────────────────
  {
    slug: "addon-website-build",
    kind: "ADDON",
    label: "Website Build",
    description:
      "Site Engine designs, builds, and ships your property marketing site in 14 days. Pre-installed pixel, chatbot, and lead capture. One-time delivery, then optional maintenance.",
    defaultPriceCents: 250000,
    cadence: null,
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 300,
  },

  // ── Capacity add-ons (metered, billed in arrears) ────────────────────
  // We surface these in the catalog so operators can flag them on a
  // proposal as "what overage looks like". The proposal builder treats
  // them as recurring lines at $0 with a note in the description; actual
  // billing happens through the metered Stripe prices once the org is
  // live (see `lib/billing/catalog.ts` ADDONS metered entries).
  {
    slug: "addon-pixel-overage",
    kind: "ADDON",
    label: "Pixel visitor overage",
    description:
      "Identified visitors beyond your plan cap. Billed monthly in arrears at $0.05 per identified visitor. Hard-capped at 100x your plan cap as a safety stop. Surfaced here for transparency — no charge until usage lands.",
    defaultPriceCents: 0,
    cadence: "MONTHLY",
    stripePriceIdMonthly: priceId("ls_pixel_overage_per_visitor_v1"),
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 310,
  },
  {
    slug: "addon-email-overage",
    kind: "ADDON",
    label: "Outbound email overage",
    description:
      "Sends beyond the 3,000-per-month cap. Billed at $0.01 per send. Includes the same deliverability monitoring, unsubscribe handling, and bounce processing as base sends.",
    defaultPriceCents: 0,
    cadence: "MONTHLY",
    stripePriceIdMonthly: priceId("ls_email_overage_per_send_v1"),
    stripePriceIdAnnual: null,
    active: true,
    sortOrder: 320,
  },
];

/**
 * Idempotently upsert the canonical proposal catalog rows by `slug`. Safe to
 * run on every app boot — no-ops when rows already match. Pricing edits in
 * the constant above are propagated on next run; the `active` flag is the
 * lever for hiding a SKU without deleting historical references.
 *
 * Returns the number of rows that were inserted or updated so callers can
 * log the result.
 */
export async function ensureCatalogSeeded(): Promise<{
  upserted: number;
  total: number;
}> {
  // review-fix: parallelize. The prior sequential `for await` did N
  // round-trips to Postgres on every invocation. At 18 SKUs and ~30ms
  // round-trip on Neon, that's ~540ms of cold-start latency every time
  // this runs (and the doc-string explicitly says "safe to run on app
  // startup"). Promise.all fans the upserts out so the wall-clock floor
  // is one round-trip plus the slowest individual write.
  const results = await Promise.all(
    PROPOSAL_CATALOG.map((item) =>
      prisma.proposalCatalogItem.upsert({
        where: { slug: item.slug },
        update: {
          kind: item.kind,
          label: item.label,
          description: item.description,
          defaultPriceCents: item.defaultPriceCents,
          cadence: item.cadence,
          stripePriceIdMonthly: item.stripePriceIdMonthly,
          stripePriceIdAnnual: item.stripePriceIdAnnual,
          active: item.active,
          sortOrder: item.sortOrder,
        },
        create: {
          slug: item.slug,
          kind: item.kind,
          label: item.label,
          description: item.description,
          defaultPriceCents: item.defaultPriceCents,
          cadence: item.cadence,
          stripePriceIdMonthly: item.stripePriceIdMonthly,
          stripePriceIdAnnual: item.stripePriceIdAnnual,
          active: item.active,
          sortOrder: item.sortOrder,
        },
      }),
    ),
  );
  return { upserted: results.length, total: PROPOSAL_CATALOG.length };
}

/**
 * Return all active catalog rows ordered for the builder picker: TIER first,
 * then ADDON, ordered by `sortOrder`. Inactive rows are excluded so a
 * deprecated SKU disappears from the picker without a destructive delete.
 */
export async function getCatalog(): Promise<ProposalCatalogItem[]> {
  return prisma.proposalCatalogItem.findMany({
    where: { active: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
  });
}

/**
 * Fetch a single catalog row by slug. Returns null on miss so callers can
 * decide how to handle a stale reference (e.g. a saved line item that
 * pointed at a now-deleted SKU).
 */
export async function getCatalogItemBySlug(
  slug: string,
): Promise<ProposalCatalogItem | null> {
  return prisma.proposalCatalogItem.findUnique({ where: { slug } });
}
