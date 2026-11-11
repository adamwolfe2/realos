/**
 * scripts/seed-ads-demo.ts
 *
 * Fills the demo workspace's paid-ads data by running the REAL ads sync
 * (runAdsSyncForAccount) against a fake Google Ads v25 + Meta v25.0 API.
 * The fake answers with the response shapes the live APIs return, so a
 * clean run proves the whole pipe: OAuth token exchange, GAQL searchStream
 * chunks, Graph paging, parsing, upserts, creative gallery, totals, and
 * campaign -> property linking. Nothing in the UI is faked.
 *
 * Safety: writes only to the org with slug "telegraph-commons-demo" (slug
 * ends in "-demo", so every cron skips it). Replaces that org's ad
 * accounts and everything under them; touches no other org.
 *
 * Run:
 *   node --env-file-if-exists=.env.local --require ./scripts/_no-server-only.cjs \
 *     --import tsx scripts/seed-ads-demo.ts --yes
 */
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { runAdsSyncForAccount } from "@/lib/integrations/ads-sync";
import { AdPlatform, LeadSource, LeadStatus, type Prisma } from "@prisma/client";

const DEMO_ORG_SLUG = "telegraph-commons-demo";
const DAYS = 90;
const GOOGLE_CUSTOMER_ID = "4418203377";
const META_ACCOUNT_ID = "902114550331";

// ─── Deterministic data ─────────────────────────────────────────────────

let seed = 20261111;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const between = (min: number, max: number) => min + rand() * (max - min);

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;
const PHOTOS = [
  "1545324418-cc1a3fa10c00", "1502672023488-70e25813eb80", "1560448204-e02f11c3d0e2",
  "1493809842364-78817add7ffb", "1486325212027-8081e485255e", "1522708323590-d24dbb6b0267",
  "1560448204-603b3fc33ddc", "1505691938895-1758d7feb511", "1448630360428-65456885c650",
  "1502672260266-1c1ef2d93688", "1484154218962-a197022b5858", "1600585154340-be6161a56a0c",
  "1600596542815-ffad4c1539a9", "1600210492486-724fe5c67fb0", "1600607687939-ce8a6c25118c",
].map(photo);

type AdPlan = {
  id: string;
  name: string;
  format: "text" | "image" | "video" | "carousel";
  headline: string;
  body: string;
  cta?: string;
  photo?: number;
  weight: number;
};
type Plan = {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget: number; // dollars
  cpc: [number, number];
  ctr: [number, number];
  cvr: [number, number]; // conversions per click
  pausedAfterDay?: number;
  ads: AdPlan[];
};

const GOOGLE: Plan[] = [
  { id: "21001", name: "Westbrook Commons | Search | Brand", status: "ENABLED", objective: "SEARCH", dailyBudget: 35, cpc: [1.4, 2.2], ctr: [0.09, 0.14], cvr: [0.09, 0.13],
    ads: [{ id: "71001", name: "", format: "text", headline: "Westbrook Commons Apartments", body: "Studios to 3 beds steps from campus. Book a tour online today.", weight: 1 }] },
  { id: "21002", name: "Park & Pearl | Search | Prospecting", status: "ENABLED", objective: "SEARCH", dailyBudget: 55, cpc: [3.1, 4.6], ctr: [0.04, 0.065], cvr: [0.05, 0.08],
    ads: [{ id: "71002", name: "", format: "text", headline: "Apartments Near Downtown", body: "Rooftop deck, in-unit laundry, pet friendly. See floor plans and pricing.", weight: 1 }] },
  { id: "21003", name: "Sage at Greenpoint | Performance Max", status: "ENABLED", objective: "PERFORMANCE_MAX", dailyBudget: 60, cpc: [0.9, 1.5], ctr: [0.012, 0.02], cvr: [0.03, 0.05],
    ads: [{ id: "71003", name: "Sage PMax - Lifestyle", format: "image", headline: "Sage at Greenpoint", body: "Light-filled homes by the park. Fall move-ins available.", cta: "Book a tour", photo: 2, weight: 1 }] },
  { id: "21004", name: "The Rhodes | Search | Fall Pre-lease", status: "ENABLED", objective: "SEARCH", dailyBudget: 40, cpc: [2.4, 3.6], ctr: [0.05, 0.08], cvr: [0.06, 0.09],
    ads: [{ id: "71004", name: "", format: "text", headline: "Pre-lease for Fall 2027", body: "Lock in this year's rate at The Rhodes. Limited 2 and 3 bed homes left.", weight: 1 }] },
  { id: "21005", name: "Portfolio | Brand Defense", status: "ENABLED", objective: "SEARCH", dailyBudget: 20, cpc: [0.8, 1.3], ctr: [0.11, 0.16], cvr: [0.08, 0.12],
    ads: [{ id: "71005", name: "", format: "text", headline: "Official Leasing Site", body: "Compare our four communities, check live availability and tour today.", weight: 1 }] },
  { id: "21006", name: "The Rhodes | Display Retargeting", status: "PAUSED", objective: "DISPLAY", dailyBudget: 25, cpc: [0.5, 0.9], ctr: [0.004, 0.008], cvr: [0.01, 0.025], pausedAfterDay: 60,
    ads: [{ id: "71006", name: "Rhodes Retargeting - Courtyard", format: "image", headline: "Still looking? Tour The Rhodes", body: "Your next home is waiting. Schedule a visit in minutes.", cta: "Schedule", photo: 11, weight: 1 }] },
];

const META: Plan[] = [
  { id: "120001", name: "Westbrook Commons | Lead Form | Fall 27", status: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudget: 45, cpc: [0.7, 1.1], ctr: [0.013, 0.019], cvr: [0.09, 0.13],
    ads: [
      { id: "620001", name: "Westbrook - Pool Deck", format: "image", headline: "Fall 2027 leasing is open", body: "Resort pool, study lounges and a 5 minute walk to class. Get pricing in one tap.", cta: "SIGN_UP", photo: 0, weight: 0.6 },
      { id: "620002", name: "Westbrook - Unit Walkthrough", format: "video", headline: "Take the 30 second tour", body: "See a furnished 2 bed before you visit.", cta: "LEARN_MORE", photo: 1, weight: 0.4 },
    ] },
  { id: "120002", name: "Park & Pearl | Reels | Tour Push", status: "ACTIVE", objective: "OUTCOME_TRAFFIC", dailyBudget: 30, cpc: [0.45, 0.8], ctr: [0.016, 0.024], cvr: [0.03, 0.05],
    ads: [
      { id: "620003", name: "Park & Pearl - Rooftop Reel", format: "video", headline: "Sunset from the rooftop", body: "Tours daily. Pick a time that works for you.", cta: "BOOK_NOW", photo: 4, weight: 0.7 },
      { id: "620004", name: "Park & Pearl - Amenities Carousel", format: "carousel", headline: "Everything you need, one address", body: "Gym, co-working, pet spa and secure parking.", cta: "LEARN_MORE", photo: 5, weight: 0.3 },
    ] },
  { id: "120003", name: "Sage at Greenpoint | Lead Form", status: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudget: 50, cpc: [0.8, 1.25], ctr: [0.011, 0.017], cvr: [0.08, 0.12],
    ads: [
      { id: "620005", name: "Sage - Park Views", format: "image", headline: "Homes by the park", body: "Bright 1 and 2 beds with balconies. Ask about move-in specials.", cta: "GET_QUOTE", photo: 7, weight: 0.55 },
      { id: "620006", name: "Sage - Kitchen", format: "image", headline: "Chef-ready kitchens", body: "Quartz counters, gas range and an island built for hosting.", cta: "SIGN_UP", photo: 6, weight: 0.45 },
    ] },
  { id: "120004", name: "The Rhodes | Retargeting", status: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudget: 25, cpc: [0.55, 0.9], ctr: [0.018, 0.026], cvr: [0.1, 0.15],
    ads: [{ id: "620007", name: "Rhodes - Come Back", format: "image", headline: "Still thinking about The Rhodes?", body: "A few fall homes are left. Book a tour this week.", cta: "BOOK_NOW", photo: 12, weight: 1 }] },
  { id: "120005", name: "WC + PP | Lookalike Prospecting", status: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudget: 35, cpc: [0.6, 1.0], ctr: [0.012, 0.018], cvr: [0.06, 0.09],
    ads: [{ id: "620008", name: "Two Communities - Compare", format: "carousel", headline: "Two great addresses", body: "Compare Westbrook Commons and Park & Pearl side by side.", cta: "LEARN_MORE", photo: 13, weight: 1 }] },
];

type Day = { date: string; impressions: number; clicks: number; spend: number; conversions: number };

function dayString(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Spend paces near budget with weekend dips; efficiency improves over the
// window so the trend lines and deltas have a story.
function simulate(plan: Plan): Map<string, Day[]> {
  const byAd = new Map<string, Day[]>(plan.ads.map((a) => [a.id, []]));
  for (let i = DAYS; i >= 1; i--) {
    const dayIndex = DAYS - i;
    if (plan.pausedAfterDay && dayIndex >= plan.pausedAfterDay) continue;
    const weekday = new Date(`${dayString(i)}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.78 : 1;
    const progress = dayIndex / DAYS;
    const spend = plan.dailyBudget * between(0.82, 1.02) * weekend;
    const cpc = between(...plan.cpc) * (1.08 - 0.16 * progress);
    const clicks = Math.max(1, Math.round(spend / cpc));
    const impressions = Math.round(clicks / between(...plan.ctr));
    const cvr = between(...plan.cvr) * (0.9 + 0.25 * progress);
    for (const ad of plan.ads) {
      const share = ad.weight * between(0.9, 1.1);
      const adClicks = Math.round(clicks * share);
      byAd.get(ad.id)!.push({
        date: dayString(i),
        impressions: Math.round(impressions * share),
        clicks: adClicks,
        spend: Math.round(spend * share * 100) / 100,
        conversions: Math.round(adClicks * cvr * between(0.6, 1.4)),
      });
    }
  }
  return byAd;
}

const sims = new Map<string, Map<string, Day[]>>(
  [...GOOGLE, ...META].map((p) => [p.id, simulate(p)]),
);
function campaignDays(plan: Plan): Day[] {
  const days = new Map<string, Day>();
  for (const rows of sims.get(plan.id)!.values()) {
    for (const r of rows) {
      const d = days.get(r.date) ?? { date: r.date, impressions: 0, clicks: 0, spend: 0, conversions: 0 };
      days.set(r.date, {
        date: r.date,
        impressions: d.impressions + r.impressions,
        clicks: d.clicks + r.clicks,
        spend: Math.round((d.spend + r.spend) * 100) / 100,
        conversions: d.conversions + r.conversions,
      });
    }
  }
  return [...days.values()];
}

// ─── Fake Google Ads v25 ────────────────────────────────────────────────

const micros = (dollars: number) => String(Math.round(dollars * 1_000_000));
const googleCampaignRef = (id: string) => `customers/${GOOGLE_CUSTOMER_ID}/campaigns/${id}`;
const googleAssetRef = (adId: string) => `customers/${GOOGLE_CUSTOMER_ID}/assets/9${adId}`;

function googleAd(p: Plan, a: AdPlan) {
  const copy = { headlines: [{ text: a.headline }], descriptions: [{ text: a.body }] };
  const ad = a.format === "image"
    ? { id: a.id, name: a.name, type: "RESPONSIVE_DISPLAY_AD", finalUrls: ["https://example.com/tour"], responsiveDisplayAd: { ...copy, callToActionText: a.cta, marketingImages: [{ asset: googleAssetRef(a.id) }] } }
    : { id: a.id, name: a.name, type: "RESPONSIVE_SEARCH_AD", finalUrls: ["https://example.com/"], responsiveSearchAd: copy };
  return { adGroupAd: { status: p.status === "PAUSED" ? "PAUSED" : "ENABLED", ad }, campaign: { id: p.id } };
}

function googleRows(query: string): unknown[] {
  const q = query.replace(/\s+/g, " ");
  const byDay = q.includes("segments.date");
  if (q.includes("FROM campaign") && byDay) {
    return GOOGLE.flatMap((p) => campaignDays(p).map((d) => ({
      campaign: { resourceName: googleCampaignRef(p.id), id: p.id },
      segments: { date: d.date },
      metrics: { impressions: String(d.impressions), clicks: String(d.clicks), costMicros: micros(d.spend), conversions: d.conversions, conversionsValue: 0 },
    })));
  }
  if (q.includes("FROM campaign")) {
    return GOOGLE.map((p) => ({
      campaign: { resourceName: googleCampaignRef(p.id), id: p.id, name: p.name, status: p.status, advertisingChannelType: p.objective, startDateTime: `${dayString(DAYS)} 00:00:00`, endDateTime: "2037-12-30 23:59:59" },
      campaignBudget: { amountMicros: micros(p.dailyBudget) },
    }));
  }
  if (q.includes("FROM ad_group_ad") && byDay) {
    return GOOGLE.flatMap((p) => p.ads.flatMap((a) => sims.get(p.id)!.get(a.id)!.map((d) => ({
      adGroupAd: { ad: { id: a.id } },
      segments: { date: d.date },
      metrics: { impressions: String(d.impressions), clicks: String(d.clicks), costMicros: micros(d.spend), conversions: d.conversions },
    }))));
  }
  if (q.includes("FROM ad_group_ad")) return GOOGLE.flatMap((p) => p.ads.map((a) => googleAd(p, a)));
  if (q.includes("FROM asset")) {
    return GOOGLE.flatMap((p) => p.ads.filter((a) => a.photo != null).map((a) => ({
      asset: { resourceName: googleAssetRef(a.id), imageAsset: { fullSize: { url: PHOTOS[a.photo!] } } },
    })));
  }
  throw new Error(`fake Google Ads: unhandled query ${q.slice(0, 120)}`);
}

// ─── Fake Meta Marketing API v25.0 ──────────────────────────────────────

// Live shape: "lead" is the total and the grouped form-lead count repeats
// part of it. The sync must count each lead once.
function metaActions(conversions: number, clicks: number) {
  return [
    { action_type: "link_click", value: String(clicks) },
    { action_type: "lead", value: String(conversions) },
    { action_type: "onsite_conversion.lead_grouped", value: String(Math.round(conversions * 0.8)) },
  ];
}

function metaAd(p: Plan, a: AdPlan) {
  const image = PHOTOS[a.photo ?? 0];
  const cta = { type: a.cta, value: { link: "https://example.com/tour" } };
  const story = a.format === "video"
    ? { video_data: { title: a.headline, message: a.body, video_id: `v${a.id}`, image_url: image, call_to_action: cta } }
    : { link_data: { link: "https://example.com/tour", name: a.headline, message: a.body, picture: image, call_to_action: cta, ...(a.format === "carousel" ? { child_attachments: [{}, {}, {}] } : {}) } };
  return { id: a.id, name: a.name, status: p.status, campaign_id: p.id, creative: { thumbnail_url: image, object_story_spec: story } };
}

const metaInsight = (d: Day) => ({
  date_start: d.date, date_stop: d.date, impressions: String(d.impressions), clicks: String(d.clicks),
  spend: d.spend.toFixed(2), actions: metaActions(d.conversions, d.clicks),
});

function metaData(path: string, params: URLSearchParams): unknown[] {
  if (path.endsWith("/campaigns")) {
    return META.map((p) => ({ id: p.id, name: p.name, status: p.status, objective: p.objective, daily_budget: String(p.dailyBudget * 100), start_time: `${dayString(DAYS)}T09:00:00-0800` }));
  }
  if (path.endsWith("/ads")) return META.flatMap((p) => p.ads.map((a) => metaAd(p, a)));
  if (path.endsWith("/insights") && params.get("level") === "campaign") {
    return META.flatMap((p) => campaignDays(p).map((d) => ({ campaign_id: p.id, ...metaInsight(d) })));
  }
  if (path.endsWith("/insights") && params.get("level") === "ad") {
    return META.flatMap((p) => p.ads.flatMap((a) => sims.get(p.id)!.get(a.id)!.map((d) => ({ ad_id: a.id, ...metaInsight(d) }))));
  }
  throw new Error(`fake Meta: unhandled path ${path}`);
}

// ─── fetch router ───────────────────────────────────────────────────────

const realFetch = globalThis.fetch;
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const calls = { googleToken: 0, googleSearch: 0, metaPages: 0 };

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "oauth2.googleapis.com") {
    calls.googleToken += 1;
    return reply({ access_token: "demo-access-token", expires_in: 3599, token_type: "Bearer" });
  }
  if (url.hostname === "googleads.googleapis.com") {
    if (!url.pathname.startsWith("/v25/")) throw new Error(`Google Ads call on retired version: ${url.pathname}`);
    calls.googleSearch += 1;
    const { query } = JSON.parse(String(init?.body)) as { query: string };
    const rows = googleRows(query);
    // searchStream answers in chunks; split so the chunk merge is exercised.
    const chunks = [];
    for (let i = 0; i < rows.length; i += 400) chunks.push({ results: rows.slice(i, i + 400) });
    return reply(chunks.length ? chunks : [{ results: [] }]);
  }
  if (url.hostname === "graph.facebook.com") {
    if (!url.pathname.startsWith("/v25.0/")) throw new Error(`Meta call on retired version: ${url.pathname}`);
    calls.metaPages += 1;
    const all = metaData(url.pathname, url.searchParams);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const offset = Number(url.searchParams.get("after") ?? 0);
    const next = offset + limit < all.length ? new URL(url) : null;
    next?.searchParams.set("after", String(offset + limit));
    return reply({ data: all.slice(offset, offset + limit), paging: next ? { next: next.href } : {} });
  }
  return realFetch(input, init);
}) as typeof fetch;

// ─── Ad-sourced leads (the AppFolio side of the story) ──────────────────
//
// Platforms over-report (one renter fills two forms, bots, duplicates), so
// roughly a third of platform conversions become real CRM leads, and a
// small share of those tour, apply and sign. Tagged externalSystem
// "ads-demo" so a re-run replaces only these rows.

const LEAD_TAG = "ads-demo";
const FIRST = ["Maya", "Jordan", "Priya", "Lucas", "Sofia", "Ethan", "Amara", "Noah", "Chloe", "Diego", "Hana", "Owen", "Leila", "Mateo", "Grace", "Kai"];
const LAST = ["Chen", "Patel", "Nguyen", "Garcia", "Kim", "Okafor", "Silva", "Rossi", "Haddad", "Novak", "Tanaka", "Reyes", "Brooks", "Ali", "Moreau", "Lund"];

function leadStatus(): LeadStatus {
  const r = rand();
  if (r < 0.07) return LeadStatus.SIGNED;
  if (r < 0.13) return LeadStatus.APPLIED;
  if (r < 0.3) return LeadStatus.TOURED;
  if (r < 0.42) return LeadStatus.TOUR_SCHEDULED;
  if (r < 0.7) return LeadStatus.CONTACTED;
  if (r < 0.85) return LeadStatus.NEW;
  return LeadStatus.LOST;
}

async function seedAdLeads(orgId: string): Promise<number> {
  await prisma.lead.deleteMany({ where: { orgId, externalSystem: LEAD_TAG } });
  const campaigns = await prisma.adCampaign.findMany({
    where: { orgId },
    select: { externalCampaignId: true, name: true, platform: true, propertyId: true },
  });
  const properties = await prisma.property.findMany({ where: { orgId }, select: { id: true } });
  const leads: Prisma.LeadCreateManyInput[] = [];
  for (const plan of [...GOOGLE, ...META]) {
    const c = campaigns.find((x) => x.externalCampaignId === plan.id);
    if (!c) continue;
    for (const d of campaignDays(plan).slice(-60)) {
      const count = Math.round(d.conversions * between(0.25, 0.4));
      for (let i = 0; i < count; i++) {
        const status = leadStatus();
        const first = FIRST[Math.floor(rand() * FIRST.length)];
        const last = LAST[Math.floor(rand() * LAST.length)];
        const at = new Date(`${d.date}T${String(8 + Math.floor(rand() * 13)).padStart(2, "0")}:00:00Z`);
        leads.push({
          orgId,
          propertyId: c.propertyId ?? properties[Math.floor(rand() * properties.length)].id,
          firstName: first,
          lastName: last,
          email: `demo+${first}.${last}.${leads.length}@example.com`.toLowerCase(),
          source: c.platform === AdPlatform.GOOGLE_ADS ? LeadSource.GOOGLE_ADS : LeadSource.META_ADS,
          sourceDetail: c.name,
          status,
          externalSystem: LEAD_TAG,
          externalId: `${plan.id}-${d.date}-${i}`,
          firstSeenAt: at,
          lastActivityAt: at,
          createdAt: at,
          convertedAt: status === LeadStatus.SIGNED ? new Date(at.getTime() + 9 * 86_400_000) : null,
        });
      }
    }
  }
  for (let i = 0; i < leads.length; i += 500) {
    await prisma.lead.createMany({ data: leads.slice(i, i + 500) });
  }
  const applied = await prisma.lead.findMany({
    where: { orgId, externalSystem: LEAD_TAG, status: { in: [LeadStatus.APPLIED, LeadStatus.SIGNED] } },
    select: { id: true, propertyId: true, createdAt: true },
  });
  await prisma.application.createMany({
    data: applied.map((l) => ({ leadId: l.id, propertyId: l.propertyId!, createdAt: new Date(l.createdAt.getTime() + 5 * 86_400_000) })),
  });
  return leads.length;
}

// ─── main ───────────────────────────────────────────────────────────────

async function main() {
  if (!process.argv.includes("--yes")) {
    throw new Error("Replaces the demo workspace's ad data. Re-run with --yes.");
  }
  const org = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG }, select: { id: true, slug: true } });
  if (!org || !org.slug.endsWith("-demo")) throw new Error(`Demo org ${DEMO_ORG_SLUG} not found`);

  // Cascades to campaigns, daily metrics, creatives and creative metrics.
  await prisma.adAccount.deleteMany({ where: { orgId: org.id } });
  await prisma.adMetricMonthly.deleteMany({ where: { orgId: org.id } });

  const google = await prisma.adAccount.create({
    data: {
      orgId: org.id, platform: AdPlatform.GOOGLE_ADS, externalAccountId: GOOGLE_CUSTOMER_ID,
      displayName: "Portfolio Search + PMax", currency: "USD", autoSyncEnabled: false,
      credentialsEncrypted: encrypt(JSON.stringify({ developerToken: "demo-dev-token", refreshToken: "demo-refresh-token-not-real", oauthClientId: "demo-client", oauthClientSecret: "demo-secret" })),
    },
  });
  const meta = await prisma.adAccount.create({
    data: {
      orgId: org.id, platform: AdPlatform.META, externalAccountId: META_ACCOUNT_ID,
      displayName: "Portfolio Facebook + Instagram", currency: "USD", autoSyncEnabled: false,
      credentialsEncrypted: encrypt(JSON.stringify({ systemUserAccessToken: "demo-system-user-token" })),
    },
  });

  const endDate = new Date(`${dayString(1)}T00:00:00Z`);
  const startDate = new Date(`${dayString(DAYS)}T00:00:00Z`);
  let failed = false;
  for (const account of [google, meta]) {
    const result = await runAdsSyncForAccount(account.id, { startDate, endDate });
    const { warnings, ...counts } = result.stats;
    console.log(account.platform, result.ok ? "ok" : `FAILED: ${result.error}`, counts, warnings.slice(0, 5));
    if (!result.ok || warnings.length || result.stats.failedWrites) failed = true;
  }

  const linked = await prisma.adCampaign.findMany({ where: { orgId: org.id }, select: { name: true, property: { select: { name: true } } } });
  for (const c of linked) console.log(`  ${c.name.padEnd(42)} -> ${c.property?.name ?? "(whole portfolio)"}`);
  console.log("fake API calls", calls);
  console.log("ad-sourced leads", await seedAdLeads(org.id));
  if (failed) throw new Error("Sync reported warnings or failures; see above.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
