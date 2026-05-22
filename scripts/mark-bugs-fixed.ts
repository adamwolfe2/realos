import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

const FIXES: Array<{ num: number; status: "FIXED" | "IN_PROGRESS"; note: string }> = [
  { num: 65, status: "FIXED", note: "Already shipped via scripts/tc-isolate.ts. 126 sibling properties pinned to lifecycle=EXCLUDED with lifecycleSetBy=OPERATOR. Only Telegraph Commons renders on /portal/properties. Verified 2026-05-21." },
  { num: 66, status: "FIXED", note: "Already shipped — view tabs for 'Has vacancies' and 'Actively leasing' removed from the toolbar in app/portal/properties/page.tsx. URL contract retained so old links still work, just no clickable tab." },
  { num: 71, status: "FIXED", note: "lib/insights/queries.ts now filters rent-roll insight kinds (renewal_cliff, vacancy_needs_boost, leasing_velocity_drop) and categories (renewals, occupancy) out of getOpenInsights + getInsightCounts. Detectors keep firing; operator surfaces are clean. Pass includeRentRoll:true to bypass." },
  { num: 76, status: "FIXED", note: "QuickActionsCard commented out in app/portal/properties/[id]/tabs/overview.tsx. Component definition retained so re-enable is one line when target routes are functional." },
  { num: 79, status: "IN_PROGRESS", note: "UI surface is fine — components/portal/reputation/source-progress.tsx already diagnoses 403 as 'Google Places API key lacks Places (New) permission. Contact the LeaseStack team.' Root cause is a Google Cloud config issue, not code: need to enable Places API (New) on the existing API key in the leasestack-integrations Google Cloud project. ETA: 10 min in Google Cloud Console once you have access." },
  { num: 94, status: "FIXED", note: "components/portal/portal-nav.tsx Tools group: Building Evaluator (and Zillow report) both set to show: NEVER. Routes still resolve so bookmarks work, but nav is clean." },
  { num: 95, status: "FIXED", note: "components/portal/portal-nav.tsx: SEO moved into Audience group (next to Properties/Leads/Visitors). Referrals moved into Engage group (with Chatbot/Popups). Platform group removed entirely." },
  { num: 98, status: "FIXED", note: "WHITE_LABEL onboarding step removed from POLISH phase in lib/onboarding/state-machine.ts. White-label still surfaces on /portal/marketplace and /portal/settings/white-label. Enum value preserved so historical step rows don't break audit queries." },
  { num: 102, status: "FIXED", note: "lib/dashboard/queries.ts getActivityFeed: chatbot items now route to /portal/leads/{leadId} when the conversation captured a lead, else to /portal/chatbot. Never routes to the gated /portal/conversations module unless explicitly enabled." },
  { num: 109, status: "FIXED", note: "components/portal/dashboard/greeting-animated.tsx: greeting is now re-computed client-side post-hydration using the browser's local hour. SSR still renders the server fallback for first paint to avoid layout shift. Norman (Eastern) and any other non-Pacific operator now sees the correct 'Good morning / afternoon / evening' for their wall clock." },
];

(async () => {
  for (const fix of FIXES) {
    const b = await prisma.bugReport.findFirst({ where: { githubIssueNumber: fix.num } });
    if (!b) { console.log(`#${fix.num}: NOT FOUND`); continue; }
    const tl = Array.isArray(b.timeline) ? (b.timeline as any[]) : [];
    tl.push({
      at: new Date().toISOString(),
      by: "system",
      byEmail: "demo-prep@leasestack.co",
      kind: "status",
      from: b.status,
      to: fix.status,
      text: fix.note,
    });
    await prisma.bugReport.update({
      where: { id: b.id },
      data: {
        status: fix.status,
        resolutionNote: fix.note,
        timeline: tl as any,
      },
    });
    console.log(`#${fix.num} -> ${fix.status}`);
  }
  await prisma.$disconnect();
})();
