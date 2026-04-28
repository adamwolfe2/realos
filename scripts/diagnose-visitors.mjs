// Diagnose where the 101 AL-synced visitors landed.
// Usage: node scripts/diagnose-visitors.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

try {
  console.log(`\n=== Visitor counts by org (last 24h) ===\n`);
  const recent = await prisma.visitor.groupBy({
    by: ["orgId"],
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    _count: { _all: true },
  });
  for (const row of recent) {
    const org = await prisma.organization.findUnique({
      where: { id: row.orgId },
      select: { name: true, slug: true, orgType: true },
    });
    console.log(
      `  ${row._count._all.toString().padStart(4)} visitors → ${org?.name ?? "?"} (${org?.slug ?? "?"}) [${org?.orgType ?? "?"}]  orgId=${row.orgId}`,
    );
  }

  console.log(`\n=== Total Visitor counts by org (all time) ===\n`);
  const all = await prisma.visitor.groupBy({
    by: ["orgId"],
    _count: { _all: true },
  });
  for (const row of all) {
    const org = await prisma.organization.findUnique({
      where: { id: row.orgId },
      select: { name: true, slug: true, orgType: true },
    });
    console.log(
      `  ${row._count._all.toString().padStart(4)} visitors → ${org?.name ?? "?"} (${org?.slug ?? "?"}) [${org?.orgType ?? "?"}]  orgId=${row.orgId}`,
    );
  }

  console.log(`\n=== SG Real Estate / Telegraph Commons orgs ===\n`);
  const sgOrgs = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: "SG", mode: "insensitive" } },
        { name: { contains: "Telegraph", mode: "insensitive" } },
        { slug: { contains: "sg", mode: "insensitive" } },
        { slug: { contains: "telegraph", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, orgType: true },
  });
  for (const o of sgOrgs) {
    const visitorCount = await prisma.visitor.count({ where: { orgId: o.id } });
    console.log(`  ${o.name} (${o.slug}) [${o.orgType}]  orgId=${o.id}  visitors=${visitorCount}`);
  }

  console.log(`\n=== CursiveIntegration rows ===\n`);
  const integrations = await prisma.cursiveIntegration.findMany({
    select: {
      orgId: true,
      cursivePixelId: true,
      cursiveSegmentId: true,
      installedOnDomain: true,
      lastEventAt: true,
      totalEventsCount: true,
      org: { select: { name: true, slug: true, orgType: true } },
    },
    orderBy: { lastEventAt: "desc" },
  });
  for (const i of integrations) {
    console.log(
      `  ${i.org.name.padEnd(30)} pixel=${i.cursivePixelId ?? "—"}  segment=${i.cursiveSegmentId ?? "—"}  domain=${i.installedOnDomain ?? "—"}  events=${i.totalEventsCount}  orgId=${i.orgId}`,
    );
  }

  console.log(`\n=== Last 5 visitors created (any org) ===\n`);
  const lastFew = await prisma.visitor.findMany({
    select: {
      id: true,
      orgId: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      source: true,
      org: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const v of lastFew) {
    console.log(
      `  ${v.createdAt.toISOString()}  ${v.org.name.padEnd(25)}  ${v.firstName ?? ""} ${v.lastName ?? ""}  ${v.email ?? ""}  source=${v.source ?? "—"}`,
    );
  }
} finally {
  await prisma.$disconnect();
}
