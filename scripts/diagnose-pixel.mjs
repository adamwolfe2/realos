// Diagnose where Cursive pixel events landed.
// Usage: node scripts/diagnose-pixel.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

const PIXEL_ID = "69e299f5d233fe5c1d74bfbb";

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

try {
  console.log(`\n=== Looking for pixel ${PIXEL_ID} ===\n`);

  const integration = await prisma.cursiveIntegration.findFirst({
    where: { cursivePixelId: PIXEL_ID },
    select: {
      id: true,
      orgId: true,
      installedOnDomain: true,
      lastEventAt: true,
      totalEventsCount: true,
      org: { select: { name: true, slug: true, orgType: true } },
    },
  });

  if (integration) {
    console.log("CursiveIntegration row found:");
    console.log(`  org:            ${integration.org.name} (${integration.org.slug}) [${integration.org.orgType}]`);
    console.log(`  orgId:          ${integration.orgId}`);
    console.log(`  domain:         ${integration.installedOnDomain ?? "—"}`);
    console.log(`  totalEvents:    ${integration.totalEventsCount}`);
    console.log(`  lastEventAt:    ${integration.lastEventAt?.toISOString() ?? "never"}`);
  } else {
    console.log(`NO CursiveIntegration row matches pixel ${PIXEL_ID}.`);
    console.log("That means webhook events with this pixel_id are being rejected (skipped: 'unknown pixel').");
  }

  console.log(`\n=== All CursiveIntegration rows ===\n`);
  const all = await prisma.cursiveIntegration.findMany({
    select: {
      cursivePixelId: true,
      installedOnDomain: true,
      totalEventsCount: true,
      lastEventAt: true,
      org: { select: { name: true, slug: true, orgType: true } },
    },
    orderBy: { lastEventAt: "desc" },
  });
  for (const row of all) {
    console.log(
      `  ${row.org.name.padEnd(30)} pixel=${row.cursivePixelId ?? "—"} events=${row.totalEventsCount} last=${row.lastEventAt?.toISOString() ?? "never"}`,
    );
  }

  console.log(`\n=== Recent webhook events (last 1h) ===\n`);
  const events = await prisma.webhookEvent.findMany({
    where: {
      source: "cursive",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: {
      id: true,
      status: true,
      orgId: true,
      eventType: true,
      processingError: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const e of events) {
    console.log(
      `  ${e.createdAt.toISOString()} status=${e.status.padEnd(10)} orgId=${e.orgId ?? "—"} type=${e.eventType ?? "—"} err=${e.processingError?.slice(0, 80) ?? ""}`,
    );
  }
  console.log(`  Total recent: ${events.length}`);

  console.log(`\n=== Visitor rows (last 1h) ===\n`);
  const visitors = await prisma.visitor.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    select: {
      id: true,
      orgId: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      org: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(`  Found ${visitors.length} visitors created in the last hour. Sample:`);
  for (const v of visitors) {
    console.log(
      `    ${v.org.name.padEnd(25)} ${v.firstName ?? ""} ${v.lastName ?? ""} ${v.email ?? ""} status=${v.status}`,
    );
  }

  console.log(`\n=== Pending pixel requests ===\n`);
  const requests = await prisma.pixelProvisionRequest.findMany({
    where: { status: "PENDING" },
    select: {
      id: true,
      websiteName: true,
      websiteUrl: true,
      requestedAt: true,
      org: { select: { name: true } },
    },
    orderBy: { requestedAt: "desc" },
  });
  for (const r of requests) {
    console.log(`  ${r.org.name.padEnd(25)} ${r.websiteName} ${r.websiteUrl} requested=${r.requestedAt.toISOString()}`);
  }
} finally {
  await prisma.$disconnect();
}
