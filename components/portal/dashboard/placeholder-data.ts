// ---------------------------------------------------------------------------
// Dashboard placeholder data
//
// Realistic-looking sample numbers + series for the operator dashboard. These
// are deterministic (no Math.random at render time) so the dashboard renders
// the same on every load and avoids hydration mismatches.
//
// REPLACE THESE WHEN THE DATA AGENTS LAND:
//   - lead source breakdown        -> aggregate from Lead.source over 28d
//   - ad spend / cost per lead     -> /lib/integrations/google-ads + meta-ads
//   - organic sessions             -> /lib/integrations/ga4
//   - hot visitors right now       -> /app/api/public/visitors live count
//   - integration health chips     -> per-integration status query
//   - per-property ad campaign cnt -> AdCampaign.where({ propertyId, active })
// ---------------------------------------------------------------------------

import type { LeadSourceSlice } from "./lead-source-donut";
import type { ActivityItem } from "./activity-feed";
import type { IntegrationChip } from "./integration-health";

export const PLACEHOLDER_LEAD_SOURCES: LeadSourceSlice[] = [
  { source: "Google Ads", count: 38 },
  { source: "Meta Ads", count: 24 },
  { source: "Organic search", count: 19 },
  { source: "Chatbot", count: 14 },
  { source: "Direct", count: 9 },
  { source: "Referral", count: 5 },
];

export const PLACEHOLDER_FUNNEL = [
  { label: "Visitors", value: 4820 },
  { label: "Engaged", value: 1240 },
  { label: "Leads", value: 109 },
  { label: "Tours", value: 41 },
  { label: "Applications", value: 17 },
];

// Smooth-looking 28d sparkline series for the KPI tiles.
export const SPARK_LEADS_28D = [3, 4, 2, 5, 6, 4, 7, 5, 8, 6, 9, 11, 8, 10, 7, 9, 12, 10, 13, 11, 14, 12, 15, 13, 16, 14, 17, 15];
export const SPARK_TOURS_28D = [1, 2, 1, 3, 2, 3, 4, 2, 3, 5, 4, 6, 3, 4, 5, 6, 4, 7, 5, 6, 4, 5, 7, 6, 8, 5, 7, 6];
export const SPARK_SPEND_28D = [120, 140, 130, 160, 145, 170, 165, 180, 175, 190, 200, 195, 210, 205, 220, 215, 225, 230, 245, 240, 255, 260, 270, 265, 280, 290, 285, 300];
export const SPARK_ORGANIC_28D = [80, 95, 88, 110, 102, 125, 118, 140, 132, 150, 145, 165, 160, 180, 175, 195, 188, 210, 205, 220, 215, 235, 230, 245, 240, 255, 250, 265];

// Realistic spend numbers ($).
export const PLACEHOLDER_AD_SPEND_28D_USD = 6840;
export const PLACEHOLDER_BLENDED_CPL_USD = 62.75;
export const PLACEHOLDER_HOT_VISITORS = 7;
export const PLACEHOLDER_TOURS_28D = 41;
export const PLACEHOLDER_ORGANIC_SESSIONS_28D = 1240;

export const PLACEHOLDER_ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    kind: "lead",
    title: "New lead from Google Ads",
    meta: "Maria L. · 2-bed inquiry",
    href: "/portal/leads",
    at: minutesAgo(4),
  },
  {
    id: "a2",
    kind: "tour",
    title: "Tour booked for Saturday",
    meta: "Telegraph Commons · 11:00am",
    href: "/portal/leads",
    at: minutesAgo(18),
  },
  {
    id: "a3",
    kind: "visitor",
    title: "Identified visitor on Floor Plans",
    meta: "Returning · 3rd visit",
    href: "/portal/visitors",
    at: minutesAgo(31),
  },
  {
    id: "a4",
    kind: "chatbot",
    title: "Chatbot conversation captured email",
    meta: "Asked about parking + lease term",
    href: "/portal/conversations",
    at: minutesAgo(52),
  },
  {
    id: "a5",
    kind: "campaign",
    title: "Meta ad set hit $500 spend",
    meta: "Spring Move-In · CTR 2.4%",
    href: "/portal/campaigns",
    at: minutesAgo(95),
  },
  {
    id: "a6",
    kind: "application",
    title: "Application submitted",
    meta: "Berkeley Student Lofts · 1-bed",
    href: "/portal/leads",
    at: minutesAgo(142),
  },
  {
    id: "a7",
    kind: "milestone",
    title: "100th lead this month",
    meta: "Up 31% vs last month",
    at: minutesAgo(220),
  },
];

export const PLACEHOLDER_INTEGRATIONS: IntegrationChip[] = [
  {
    key: "gsc",
    label: "Google Search Console",
    status: "connected",
    href: "/portal/seo",
    glyph: "GSC",
  },
  {
    key: "ga4",
    label: "Google Analytics 4",
    status: "connected",
    href: "/portal/seo",
    glyph: "GA4",
  },
  {
    key: "google-ads",
    label: "Google Ads",
    status: "connected",
    href: "/portal/campaigns",
  },
  {
    key: "meta-ads",
    label: "Meta Ads",
    status: "degraded",
    href: "/portal/campaigns",
  },
  {
    key: "appfolio",
    label: "AppFolio",
    status: "connected",
    href: "/portal/settings/integrations",
  },
  {
    key: "cursive",
    label: "Cursive pixel",
    status: "off",
    href: "/portal/visitors",
  },
];

// Per-property placeholder accents — small lead sparklines + occupancy %.
// These are paired by index with whatever properties come back from Prisma.
export const PROPERTY_PLACEHOLDER_BUCKET: Array<{
  occupancyPct: number;
  leads28d: number;
  leadsSpark: number[];
  activeCampaigns: number;
}> = [
  {
    occupancyPct: 94,
    leads28d: 28,
    leadsSpark: [1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 4, 6],
    activeCampaigns: 3,
  },
  {
    occupancyPct: 81,
    leads28d: 19,
    leadsSpark: [3, 2, 4, 3, 5, 4, 3, 5, 4, 6, 5, 4, 6, 5],
    activeCampaigns: 2,
  },
  {
    occupancyPct: 68,
    leads28d: 12,
    leadsSpark: [2, 3, 1, 4, 2, 3, 4, 2, 5, 3, 4, 6, 3, 5],
    activeCampaigns: 1,
  },
  {
    occupancyPct: 88,
    leads28d: 22,
    leadsSpark: [2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 5, 6, 7, 8],
    activeCampaigns: 2,
  },
  {
    occupancyPct: 72,
    leads28d: 9,
    leadsSpark: [1, 1, 2, 1, 3, 2, 4, 2, 3, 5, 3, 4, 2, 4],
    activeCampaigns: 1,
  },
];

function minutesAgo(n: number): Date {
  // Use a fixed reference relative to "now" at call time. The page is server-
  // rendered (force-dynamic) so this resolves once per request, not per render.
  return new Date(Date.now() - n * 60 * 1000);
}
