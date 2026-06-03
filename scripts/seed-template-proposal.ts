/**
 * Creates a DRAFT proposal in prod that serves as the "Hosted marketing
 * site + Pixel + Chatbot launch in 6 weeks" template — fully populated
 * scope narrative + 4-phase timeline + line items. Open the resulting
 * /admin/proposals/<id> URL to clone, customize, and send.
 *
 * Idempotent on the prospectEmail key — re-running upserts the same row.
 *
 * Run:
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx scripts/seed-template-proposal.ts
 */
import {
  ProposalCadence,
  ProposalLineKind,
  ProposalStatus,
} from "@prisma/client";
import { prisma } from "../lib/db";
import { generateProposalNumber } from "../lib/proposals/numbering";
import { computeSubtotalsCents } from "../lib/proposals/totals";

const TEMPLATE_PROSPECT_EMAIL = "template+onboarding@leasestack.co";

const SCOPE_NARRATIVE = `We'll launch your property's full marketing surface in six weeks: a hosted, per-property landing site optimized for AI search and lead capture, the AI Leasing Chatbot trained on your unit data, and the Cursive visitor identification pixel for anonymous visitor-to-lead resolution.

**Week 1 — Kickoff & data plumbing.** We connect your PMS (AppFolio, Yardi, Buildium, Entrata, RealPage, MRI, ResMan, Propertyware, or Rent Manager), Google Search Console, Google Analytics 4, and your ad accounts in one onboarding call.

**Weeks 2–4 — Build & content.** We design and ship the hosted marketing site under your domain (yourproperty.com), train the Leasing Chatbot on your floor plans + pricing + amenities, install the Cursive pixel for visitor identification, and seed your AEO + SEO content with the prompts your prospects actually search.

**Week 5 — Launch & ad activation.** We go live on the production domain, activate Google Ads + Meta Ads with the managed setup, and configure lead routing to your team's Slack/email.

**Week 6 — Optimization & review.** We review the first week of live data together, tune the chatbot's responses based on real conversations, and hand off the dashboard so your leasing team can self-serve from week 7 onward.

You get **weekly performance reviews and a dedicated Slack channel for the first 60 days** post-launch.`;

const TIMELINE = [
  {
    phase: "Kickoff & data plumbing",
    startWeek: 1,
    endWeek: 1,
    deliverables: [
      "60-min onboarding call with your leasing team",
      "PMS connector configured (AppFolio / Yardi / etc.)",
      "Google Search Console + GA4 + ad accounts linked",
      "Brand colors, logo, fonts captured in the portal",
    ],
  },
  {
    phase: "Build & content",
    startWeek: 2,
    endWeek: 4,
    deliverables: [
      "Hosted property site live on staging URL",
      "AI Leasing Chatbot trained on floor plans + pricing + amenities",
      "Cursive visitor identification pixel installed",
      "Initial AEO + SEO content seeded (10+ pages of structured copy)",
      "Per-neighborhood landing pages (3 priority neighborhoods)",
    ],
  },
  {
    phase: "Launch & ad activation",
    startWeek: 5,
    endWeek: 5,
    deliverables: [
      "Production domain cutover (yourproperty.com goes live)",
      "Google Ads + Meta Ads campaigns launched with managed setup",
      "Lead routing wired into Slack + email",
      "Dedicated Slack channel created for your team",
    ],
  },
  {
    phase: "Optimization & 60-day support",
    startWeek: 6,
    endWeek: 14,
    deliverables: [
      "First-week performance review session",
      "Weekly performance review for the first 60 days",
      "Chatbot fine-tuning based on real prospect conversations",
      "Monthly executive report on lead volume, conversion, and AI visibility",
    ],
  },
];

(async () => {
  console.log("=== Template proposal seed ===\n");

  // Find required catalog items
  const catalog = await prisma.proposalCatalogItem.findMany({
    where: {
      slug: {
        in: [
          "tier-growth",
          "addon-aeo-boost",
          "addon-cursive-pixel-pro",
          "addon-chatbot-pro",
        ],
      },
    },
    select: {
      id: true,
      slug: true,
      label: true,
      description: true,
      defaultPriceCents: true,
      cadence: true,
    },
  });
  console.log(`Found ${catalog.length} matching catalog items`);
  catalog.forEach((c) =>
    console.log(`  - ${c.slug}: ${c.label} ($${c.defaultPriceCents / 100})`),
  );

  const tierGrowth = catalog.find((c) => c.slug === "tier-growth");
  const aeoBoost = catalog.find((c) => c.slug === "addon-aeo-boost");
  const pixelPro = catalog.find((c) => c.slug === "addon-cursive-pixel-pro");
  const chatbotPro = catalog.find((c) => c.slug === "addon-chatbot-pro");

  // Upsert prospect: idempotent on email.
  const existing = await prisma.proposal.findFirst({
    where: { prospectEmail: TEMPLATE_PROSPECT_EMAIL },
    select: { id: true, number: true },
  });

  if (existing) {
    console.log(`\nExisting template proposal: ${existing.number} (${existing.id}) — updating…`);
    await prisma.proposalLineItem.deleteMany({
      where: { proposalId: existing.id },
    });
    await populateProposal(existing.id, {
      tierGrowth,
      aeoBoost,
      pixelPro,
      chatbotPro,
    });
    console.log(`Open: /admin/proposals/${existing.id}`);
    await prisma.$disconnect();
    return;
  }

  const number = await generateProposalNumber();
  const created = await prisma.proposal.create({
    data: {
      number,
      status: ProposalStatus.DRAFT,
      prospectName: "[ TEMPLATE — Hosted Site + Pixel + Chatbot in 6 weeks ]",
      prospectEmail: TEMPLATE_PROSPECT_EMAIL,
      prospectCompany: "Sample Client Co.",
      cadence: ProposalCadence.MONTHLY,
      trialDays: 14,
      currency: "usd",
      publicMessage:
        "Tailored for properties looking to launch a complete digital marketing surface in 6 weeks. Includes hosted site, AI leasing chatbot, visitor pixel, and managed Google + Meta ads. See the scope and timeline below — every phase has concrete deliverables you can hold us to.",
    },
    select: { id: true, number: true },
  });
  console.log(`\nCreated proposal ${created.number} (${created.id})`);
  await populateProposal(created.id, {
    tierGrowth,
    aeoBoost,
    pixelPro,
    chatbotPro,
  });
  console.log(`\nOpen: /admin/proposals/${created.id}`);
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

type CatalogItem = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  defaultPriceCents: number;
};

async function populateProposal(
  proposalId: string,
  cat: {
    tierGrowth: CatalogItem | undefined;
    aeoBoost: CatalogItem | undefined;
    pixelPro: CatalogItem | undefined;
    chatbotPro: CatalogItem | undefined;
  },
): Promise<void> {
  const lines: Array<{
    kind: ProposalLineKind;
    catalogItemId: string | null;
    label: string;
    description: string | null;
    unitPriceCents: number;
    quantity: number;
    recurring: boolean;
    sortOrder: number;
  }> = [];

  // Recurring (subscription) lines — same cadence (MONTHLY).
  if (cat.tierGrowth) {
    lines.push({
      kind: ProposalLineKind.TIER,
      catalogItemId: cat.tierGrowth.id,
      label: cat.tierGrowth.label,
      description: cat.tierGrowth.description,
      unitPriceCents: cat.tierGrowth.defaultPriceCents,
      quantity: 1,
      recurring: true,
      sortOrder: 0,
    });
  } else {
    lines.push({
      kind: ProposalLineKind.TIER,
      catalogItemId: null,
      label: "Growth tier",
      description:
        "Hosted property site + Leasing Chatbot + Cursive visitor pixel + AEO/SEO module + weekly performance reports.",
      unitPriceCents: 99900,
      quantity: 1,
      recurring: true,
      sortOrder: 0,
    });
  }
  if (cat.aeoBoost) {
    lines.push({
      kind: ProposalLineKind.ADDON,
      catalogItemId: cat.aeoBoost.id,
      label: cat.aeoBoost.label,
      description: cat.aeoBoost.description,
      unitPriceCents: cat.aeoBoost.defaultPriceCents,
      quantity: 1,
      recurring: true,
      sortOrder: 1,
    });
  }
  if (cat.pixelPro) {
    lines.push({
      kind: ProposalLineKind.ADDON,
      catalogItemId: cat.pixelPro.id,
      label: cat.pixelPro.label,
      description: cat.pixelPro.description,
      unitPriceCents: cat.pixelPro.defaultPriceCents,
      quantity: 1,
      recurring: true,
      sortOrder: 2,
    });
  }
  if (cat.chatbotPro) {
    lines.push({
      kind: ProposalLineKind.ADDON,
      catalogItemId: cat.chatbotPro.id,
      label: cat.chatbotPro.label,
      description: cat.chatbotPro.description,
      unitPriceCents: cat.chatbotPro.defaultPriceCents,
      quantity: 1,
      recurring: true,
      sortOrder: 3,
    });
  }

  // NOTE: a one-time setup fee mixed with a recurring subscription is
  // BLOCKED by v1 (Stripe Checkout dropped mixed support). The template
  // intentionally avoids the SETUP line — operators who want to charge
  // a setup fee should split it into a separate Proposal #1 for the
  // one-time setup, then this recurring Proposal #2 for the ongoing
  // subscription. See lib/proposals/build-checkout-session.ts for the
  // validation that enforces this.

  if (lines.length === 0) {
    throw new Error(
      "No catalog items found AND no fallback — check that ensureCatalogSeeded() has run against this DB.",
    );
  }

  await prisma.proposalLineItem.createMany({
    data: lines.map((l) => ({ ...l, proposalId })),
  });

  const subtotals = computeSubtotalsCents(lines);

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      cadence: ProposalCadence.MONTHLY,
      trialDays: 14,
      currency: "usd",
      scopeNarrative: SCOPE_NARRATIVE,
      timeline: TIMELINE as unknown as object,
      recurringSubtotalCents: subtotals.recurring,
      oneTimeSubtotalCents: subtotals.oneTime,
      // Invalidate PDF cache + bump checkout version so a re-seed
      // produces a fresh artifact on next render.
      pdfCachedAt: null,
      pdfBlobUrl: null,
      checkoutVersion: { increment: 1 },
    },
  });

  console.log(
    `  ✓ ${lines.length} line items + scope + ${TIMELINE.length}-phase timeline`,
  );
  console.log(
    `  ✓ Recurring subtotal: $${subtotals.recurring / 100} · One-time: $${subtotals.oneTime / 100}`,
  );
}
