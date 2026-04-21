/**
 * purge-demo-data.ts — wipe operational demo data from a CLIENT org so the
 * portal renders empty rather than "full of fake names." Keeps the org,
 * users, domains, tenant site config, and properties; deletes leads,
 * visitors, chatbot conversations, tours, applications, creative requests,
 * and any integration-request rows.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/purge-demo-data.ts --org-slug telegraph-commons
 *
 * Idempotent. Refuses to run without explicit --org-slug. Guard against
 * accidentally wiping production tenant data: the script will not run in
 * NODE_ENV=production unless PURGE_DEMO_DATA=1 is set.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.PURGE_DEMO_DATA !== "1"
  ) {
    throw new Error(
      "Refusing to run in production without PURGE_DEMO_DATA=1 env flag."
    );
  }

  const orgSlug = arg("--org-slug");
  if (!orgSlug) throw new Error("--org-slug is required");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const prisma = new PrismaClient({
    adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
  });

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, orgType: true },
  });
  if (!org) throw new Error(`Org not found: slug=${orgSlug}`);
  if (org.orgType !== "CLIENT") {
    throw new Error(`Org ${orgSlug} is not a CLIENT org. Aborting.`);
  }

  const scope = { orgId: org.id };

  // Order matters: delete children before parents so FK constraints don't
  // block. Applications belong to Leads; Tours belong to Leads.
  const apps = await prisma.application.deleteMany({
    where: { lead: scope },
  });
  const tours = await prisma.tour.deleteMany({
    where: { lead: scope },
  });
  const convos = await prisma.chatbotConversation.deleteMany({
    where: scope,
  });
  const creative = await prisma.creativeRequest.deleteMany({
    where: scope,
  });
  const leads = await prisma.lead.deleteMany({
    where: scope,
  });
  const visitorEvents = await prisma.visitorEvent.deleteMany({
    where: scope,
  });
  const visitorSessions = await prisma.visitorSession.deleteMany({
    where: scope,
  });
  const visitors = await prisma.visitor.deleteMany({
    where: scope,
  });
  const seoQueries = await prisma.seoQuery.deleteMany({ where: scope });
  const seoPages = await prisma.seoLandingPage.deleteMany({ where: scope });
  const seoSnapshots = await prisma.seoSnapshot.deleteMany({ where: scope });
  const adMetrics = await prisma.adMetricDaily.deleteMany({ where: scope });
  const adCampaigns = await prisma.adCampaign.deleteMany({ where: scope });
  const adAccounts = await prisma.adAccount.deleteMany({ where: scope });
  const requests = await prisma.integrationRequest.deleteMany({
    where: scope,
  });
  const audits = await prisma.auditEvent.deleteMany({
    where: scope,
  });
  const listings = await prisma.listing.deleteMany({
    where: { property: scope },
  });
  const notes = await prisma.clientNote.deleteMany({
    where: scope,
  });

  console.log(
    `\nPurged demo data for ${org.name} (${orgSlug}):\n` +
      `  Leads:                 ${leads.count}\n` +
      `  Visitors:              ${visitors.count}\n` +
      `  Visitor sessions:      ${visitorSessions.count}\n` +
      `  Visitor events:        ${visitorEvents.count}\n` +
      `  Chatbot conversations: ${convos.count}\n` +
      `  Applications:          ${apps.count}\n` +
      `  Tours:                 ${tours.count}\n` +
      `  Creative requests:     ${creative.count}\n` +
      `  Listings:              ${listings.count}\n` +
      `  Client notes:          ${notes.count}\n` +
      `  SEO snapshots:         ${seoSnapshots.count}\n` +
      `  SEO queries:           ${seoQueries.count}\n` +
      `  SEO landing pages:     ${seoPages.count}\n` +
      `  Ad accounts:           ${adAccounts.count}\n` +
      `  Ad campaigns:          ${adCampaigns.count}\n` +
      `  Ad metrics (daily):    ${adMetrics.count}\n` +
      `  Integration requests:  ${requests.count}\n` +
      `  Audit events:          ${audits.count}\n\n` +
      `Kept: org, users, domains, tenant site config, properties.\n` +
      `When AppFolio is connected, real listings will populate automatically.\n`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("purge failed:", err);
  process.exit(1);
});
