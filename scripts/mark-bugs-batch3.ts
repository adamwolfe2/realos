import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

const FIXES: Array<{ num: number; status: "FIXED" | "IN_PROGRESS"; note: string }> = [
  { num: 64, status: "FIXED", note: "components/portal/portal-nav.tsx: Properties nav item now uses `badge: () => null` so the 99+ pending-curation counter no longer pollutes the sidebar. Comment in the nav references this issue." },
  { num: 67, status: "FIXED", note: "app/portal/properties/page.tsx header description now reads '{N} properties · {N} leads' — listings + availabilities suppressed (the 141 vs 5 mismatch Norman called out). Queries retained so the toolbar tabs still get accurate counts. Norman's open question on '3 leads' is a data semantics decision (lead = Lead row, identified visitors live separately) — see below." },
  { num: 72, status: "FIXED", note: "Property hero stats (app/portal/properties/[id]/page.tsx heroStats) are now Leads/Conversations/Units/Reputation — rent-roll metrics (Occupancy, Monthly Rent, Renewals) removed. Marketing data lives in MarketingSection per #75. WUV/DUV are non-standard so we use the closest equivalent (organic sessions) on the MarketingSection." },
  { num: 73, status: "FIXED", note: "ActivityTimeline event builder in overview.tsx now skips the lease loop entirely (`void _leases`) and only emits lead/tour/review events. Comment: 'Lease loop intentionally omitted'." },
  { num: 74, status: "FIXED", note: "Property integrations sidebar now matches BOTH property-scoped AND org-wide integration rows (where: { orgId, OR: [{ propertyId }, { propertyId: null }] }) — fixes the case where SG wired GA4/Cursive at the org level but the property page showed them as off." },
  { num: 75, status: "FIXED", note: "MarketingSection promoted to main column on app/portal/properties/[id]/tabs/overview.tsx — shows organic traffic + ad spend + chatbot engagement + leads/tours/applications, all on a 28-day window. Replaces the misleading 'X listings / Y leads' static counts." },
  { num: 78, status: "IN_PROGRESS", note: "Acquisitions panel currently surfaces what AppFolio provides. Norman flagged he's fine with current state but wants better app/tour data via AppFolio sync hardening (issue tracked separately). Action: get sample input from Jessica on what to display before designing the replacement." },
  { num: 85, status: "IN_PROGRESS", note: "Draft-response generator needs a residential-multifamily / student-housing tone (currently leans hotel-hospitality). Fix is in lib/reputation/draft.ts (or wherever buildResponseDraft lives) — swap the system prompt + examples. Punted to a separate sprint so the rest of the demo prep stays focused." },
  { num: 86, status: "FIXED", note: "components/portal/reputation/mention-card.tsx now hard-focuses the draft textarea on open so the browser brings the modal into view, plus the modal fades in with a brief scale so the motion catches the eye even when the operator's scroll position was far down the page. Tone fix is tracked separately on #85." },
  { num: 89, status: "FIXED", note: "components/portal/reputation/mention-card.tsx: relative dates for mentions under 6 months ('2 weeks ago') and explicit month+year for older ones ('Mar 2022'). Matches Norman's exact ask." },
  { num: 99, status: "FIXED", note: "Both onboarding checklists (floating + inline) updated to describe what a neighborhood landing page actually does: an AI-drafted long-form page about the neighborhood around your property that captures organic + AI-search traffic. Norman's confusion was warranted — old copy just said 'Publish a neighborhood SEO page' with no explanation." },
  { num: 105, status: "FIXED", note: "Sync button (RunAppFolioSyncButton) lives directly on the AppFolio connect card in components/portal/connect/connect-hub.tsx with label='Sync now'. Visible whenever the integration row exists. Same component used on the AppFolioStatusBanner so the affordance follows the operator wherever they see a sync state." },
  { num: 106, status: "FIXED", note: "app/portal/billing/page.tsx WebsiteBuildCard removed and replaced with a quiet link to /portal/marketplace per Norman's 'less salesy / template-y' feedback. The marketplace remains the sales surface." },
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
      data: { status: fix.status, resolutionNote: fix.note, timeline: tl as any },
    });
    console.log(`#${fix.num} -> ${fix.status}`);
  }
  await prisma.$disconnect();
})();
