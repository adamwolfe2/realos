import "server-only";
import { generateObject } from "ai";
import { adLeadWhere } from "@/lib/integrations/ad-lead-source";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { AdPlatform, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd } from "@/lib/aeo/engines/pricing";
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";
import { TOURED_OR_LATER, weekStart } from "@/lib/integrations/ads-insights-math";
import { fallbackBrief, type Brief, type BriefFacts, type BriefWeek } from "@/lib/integrations/ads-brief-text";
import type { Detector, DetectedInsight } from "../types";
import { realAdAccountWhere } from "@/lib/integrations/real-ad-account";

const DAY = 86_400_000;
const BRIEF_MODEL = "claude-sonnet-4-5";

const briefSchema = z.object({
  headline: z.string().max(110),
  summary: z.string().max(700),
  // No .max() on the array: Anthropic structured output rejects maxItems.
  // The prompt asks for 1-3 and the result is trimmed to 3 below.
  decisions: z.array(z.object({ title: z.string().max(110), why: z.string().max(280) })),
});

const SYSTEM = `You write a short Monday read of last week's paid ads for a property
manager. You get the numbers as JSON. Rules:
- Use only numbers in the JSON. Never invent a figure, cause, or benchmark.
- Plain, calm English. No hype, no jargon, no exclamation marks.
- headline: one line, the single most important thing that happened.
- summary: 2-3 sentences. What moved vs the week before and what it means
  for leasing (leads, tours, signed leases), not just clicks.
- decisions: 1-3 concrete things to decide this week, each with why, tied
  to a specific property or campaign from the JSON. They are suggestions:
  the manager decides. If the numbers are too small to conclude anything,
  say so instead of guessing.`;

/**
 * Weekly ads brief: one per org per ISO week, about the last full week
 * (Mon-Sun). Claude writes it from the numbers; without a key, or on a
 * failed call, a rule-written brief ships instead. Generated once: the
 * detector checks for the week's row before calling Claude, so the daily
 * cron costs one call per org per week.
 */
export const adsWeeklyBriefDetector: Detector = {
  name: "ads-weekly-brief",
  async run(orgId: string, propertyIds: string[]): Promise<DetectedInsight[]> {
    const monday = weekStart(new Date(Date.now() - 7 * DAY));
    const dedupeKey = `ads_weekly_brief:${monday}`;
    const existing = await prisma.insight.findUnique({
      where: { orgId_dedupeKey: { orgId, dedupeKey } },
      select: { id: true },
    });
    if (existing) return [];

    const facts = await gatherFacts(orgId, propertyIds, monday);
    if (!facts) return [];
    const brief = await writeBrief(orgId, facts);

    return [
      {
        kind: "ads_weekly_brief",
        category: "ads",
        severity: "info",
        title: brief.headline,
        body: brief.summary,
        suggestedAction: brief.decisions[0]?.title ?? null,
        propertyId: null,
        entityType: null,
        entityId: null,
        href: "/portal/ads",
        dedupeKey,
        context: { weekStart: monday, decisions: brief.decisions, facts },
      },
    ];
  },
};

function emptyWeek(): BriefWeek {
  return { spendCents: 0, googleCents: 0, metaCents: 0, conversions: 0, leads: 0, tours: 0, signed: 0 };
}

async function gatherFacts(orgId: string, propertyIds: string[], monday: string): Promise<BriefFacts | null> {
  const thisStart = new Date(`${monday}T00:00:00Z`);
  const thisEnd = new Date(thisStart.getTime() + 7 * DAY);
  const lastStart = new Date(thisStart.getTime() - 7 * DAY);

  const realAccount = await realAdAccountWhere(orgId);
  const campaigns = await prisma.adCampaign.findMany({
    where: { orgId, OR: [propertyIdsToWhere(propertyIds), { propertyId: null }], adAccount: realAccount },
    select: { id: true, name: true, platform: true, property: { select: { name: true } } },
  });
  if (campaigns.length === 0) return null;
  const byId = new Map(campaigns.map((c) => [c.id, c]));

  const [metrics, leads, openInsights] = await Promise.all([
    prisma.adMetricDaily.findMany({
      where: {
        orgId, // property-scope: org-level — campaign ids above are already limited to enabled properties
        campaignId: { in: campaigns.map((c) => c.id) },
        date: { gte: lastStart, lt: thisEnd },
      },
      select: { campaignId: true, date: true, spendCents: true, conversions: true },
    }),
    prisma.lead.findMany({
      where: {
        orgId,
        ...propertyIdsToWhere(propertyIds),
        ...adLeadWhere(),
        createdAt: { gte: lastStart, lt: thisEnd },
      },
      select: { createdAt: true, status: true, property: { select: { name: true } } },
    }),
    prisma.insight.findMany({
      where: {
        orgId,
        OR: [propertyIdsToWhere(propertyIds), { propertyId: null }],
        category: "ads",
        status: "open",
        kind: { not: "ads_weekly_brief" },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true },
    }),
  ]);

  const weeks = { this: emptyWeek(), last: emptyWeek() };
  const perCampaign = new Map<string, { spend: number; conv: number }>();
  const perProperty = new Map<string, { name: string; spendCents: number; leads: number; signed: number }>();
  const prop = (name: string) => {
    const r = perProperty.get(name) ?? { name, spendCents: 0, leads: 0, signed: 0 };
    perProperty.set(name, r);
    return r;
  };

  for (const m of metrics) {
    const w = m.date >= thisStart ? weeks.this : weeks.last;
    const c = byId.get(m.campaignId);
    w.spendCents += m.spendCents;
    w.conversions += m.conversions;
    if (c?.platform === AdPlatform.GOOGLE_ADS) w.googleCents += m.spendCents;
    if (c?.platform === AdPlatform.META) w.metaCents += m.spendCents;
    if (m.date >= thisStart) {
      const pc = perCampaign.get(m.campaignId) ?? { spend: 0, conv: 0 };
      perCampaign.set(m.campaignId, { spend: pc.spend + m.spendCents, conv: pc.conv + m.conversions });
      if (c?.property) prop(c.property.name).spendCents += m.spendCents;
    }
  }
  for (const l of leads) {
    const w = l.createdAt >= thisStart ? weeks.this : weeks.last;
    w.leads += 1;
    if (TOURED_OR_LATER.has(l.status)) w.tours += 1;
    if (l.status === LeadStatus.SIGNED) w.signed += 1;
    if (l.createdAt >= thisStart && l.property) {
      const r = prop(l.property.name);
      r.leads += 1;
      if (l.status === LeadStatus.SIGNED) r.signed += 1;
    }
  }
  if (weeks.this.spendCents === 0 && weeks.last.spendCents === 0) return null;

  const ranked = [...perCampaign.entries()]
    .filter(([, v]) => v.conv >= 3 && v.spend > 0)
    .map(([id, v]) => ({ name: byId.get(id)!.name, costPerConversionCents: Math.round(v.spend / v.conv) }))
    .sort((a, b) => a.costPerConversionCents - b.costPerConversionCents);

  return {
    weekStart: monday,
    thisWeek: { ...weeks.this, conversions: Math.round(weeks.this.conversions) },
    lastWeek: { ...weeks.last, conversions: Math.round(weeks.last.conversions) },
    properties: [...perProperty.values()].sort((a, b) => b.spendCents - a.spendCents).slice(0, 8),
    bestCampaign: ranked[0] ?? null,
    worstCampaign: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    openSuggestions: openInsights.map((i) => i.title),
  };
}

async function writeBrief(orgId: string, facts: BriefFacts): Promise<Brief> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackBrief(facts);
  const startedAt = Date.now();
  try {
    const { object, usage } = await generateObject({
      model: anthropic(BRIEF_MODEL),
      schema: briefSchema,
      system: SYSTEM,
      prompt: `Numbers for the week starting ${facts.weekStart} (money in cents):\n${JSON.stringify(facts)}`,
      maxOutputTokens: 1024,
    });
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    await logUsage({
      provider: "anthropic",
      endpoint: `${BRIEF_MODEL}/ads-weekly-brief`,
      status: "SUCCESS",
      costUsd: tokenCostUsd(BRIEF_MODEL, inputTokens, outputTokens),
      durationMs: Date.now() - startedAt,
      orgId,
      propertyId: null,
      meta: { model: BRIEF_MODEL, inputTokens, outputTokens },
    });
    return { ...object, decisions: object.decisions.slice(0, 3) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[insights.ads-weekly-brief] Claude call failed; using rule-written brief:", message);
    await logUsage({
      provider: "anthropic",
      endpoint: `${BRIEF_MODEL}/ads-weekly-brief`,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      orgId,
      propertyId: null,
      meta: { model: BRIEF_MODEL, error: message },
    });
    return fallbackBrief(facts);
  }
}
