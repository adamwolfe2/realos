/**
 * diagnose-real-tc — investigate why the SG Real Estate / Telegraph Commons
 * dashboard reads as empty (0 leads, 0 tours scheduled, 0 organic visitors,
 * 0 active properties) despite the activity feed showing real chatbot
 * captures + new-lead events from "Telegraph Commons".
 *
 * Pulls the org row, every Property under it (with lifecycle status),
 * lead/tour/application counts in the 28-day window the dashboard uses,
 * + a sample of recent activity to cross-check against the screenshot.
 *
 * Read-only. Safe to run against prod.
 */

import { prisma } from "../lib/db";

(async () => {
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: "SG Real", mode: "insensitive" } },
        { name: { contains: "telegraph", mode: "insensitive" } },
        { slug: { contains: "telegraph", mode: "insensitive" } },
        { slug: { contains: "sg-real", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      moduleSEO: true,
      moduleChatbot: true,
      modulePixel: true,
      moduleLeadCapture: true,
      createdAt: true,
    },
  });
  console.log("Candidate orgs:");
  console.log(orgs);

  if (orgs.length === 0) {
    console.log("No orgs matched. Searching for any org with 'Tel' or 'SG':");
    const wider = await prisma.organization.findMany({
      where: {
        OR: [
          { name: { contains: "Tel", mode: "insensitive" } },
          { name: { contains: "SG", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true },
      take: 25,
    });
    console.log(wider);
    return;
  }

  for (const org of orgs) {
    console.log(`\n=== ORG: ${org.name} (${org.id}) ===`);
    console.log("Slug:", org.slug);
    console.log(
      "Modules: SEO=",
      org.moduleSEO,
      "Chatbot=",
      org.moduleChatbot,
      "Pixel=",
      org.modulePixel,
      "LeadCapture=",
      org.moduleLeadCapture,
    );

    // Properties — split by lifecycle so we see what the dashboard
    // considers "active" vs everything else.
    const properties = await prisma.property.findMany({
      where: { orgId: org.id },
      select: {
        id: true,
        name: true,
        lifecycle: true,
        launchStatus: true,
        propertyType: true,
        websiteUrl: true,
      },
    });
    const byLifecycle = properties.reduce<Record<string, number>>((acc, p) => {
      acc[p.lifecycle] = (acc[p.lifecycle] ?? 0) + 1;
      return acc;
    }, {});
    const byLaunch = properties.reduce<Record<string, number>>((acc, p) => {
      acc[p.launchStatus] = (acc[p.launchStatus] ?? 0) + 1;
      return acc;
    }, {});
    console.log("\nProperties:", properties.length, "total");
    console.log("Lifecycle breakdown:", byLifecycle);
    console.log("LaunchStatus breakdown:", byLaunch);
    console.log(
      "Marketable (ACTIVE + LIVE/SOFT):",
      properties.filter(
        (p) =>
          p.lifecycle === "ACTIVE" &&
          (p.launchStatus === "LIVE" || p.launchStatus === "SOFT_LAUNCH"),
      ).length,
    );
    console.log("First 10:");
    for (const p of properties.slice(0, 10)) {
      console.log(
        `  - ${p.name} · lifecycle=${p.lifecycle} · launch=${p.launchStatus} · type=${p.propertyType}`,
      );
    }

    const now = new Date();
    const day28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Leads
    const leadsAll = await prisma.lead.count({ where: { orgId: org.id } });
    const leads28 = await prisma.lead.count({
      where: { orgId: org.id, createdAt: { gte: day28 } },
    });
    console.log(`\nLeads: all-time=${leadsAll} · 28d=${leads28}`);
    const leadsByProperty = await prisma.lead.groupBy({
      where: { orgId: org.id },
      by: ["propertyId"],
      _count: { id: true },
    });
    console.log("Leads by propertyId:", leadsByProperty);

    // Tours
    const toursAll = await prisma.tour.count({
      where: { lead: { orgId: org.id } },
    });
    const tours28 = await prisma.tour.count({
      where: {
        lead: { orgId: org.id },
        scheduledAt: { gte: day28 },
      },
    });
    console.log(`Tours: all-time=${toursAll} · 28d-scheduled=${tours28}`);

    // Chatbot conversations
    const convos = await prisma.chatbotConversation.count({
      where: { orgId: org.id },
    });
    const convos28 = await prisma.chatbotConversation.count({
      where: { orgId: org.id, createdAt: { gte: day28 } },
    });
    console.log(`Chatbot conversations: all-time=${convos} · 28d=${convos28}`);

    // Visitors
    const visitors = await prisma.visitor.count({
      where: { orgId: org.id },
    });
    const visitors28 = await prisma.visitor.count({
      where: { orgId: org.id, firstSeenAt: { gte: day28 } },
    });
    console.log(`Visitors: all-time=${visitors} · 28d=${visitors28}`);

    // SEO daily snapshots
    const seo = await prisma.seoSnapshot.count({
      where: { orgId: org.id, date: { gte: day28 } },
    });
    console.log(`SeoSnapshot 28d rows: ${seo}`);

    // Recent activity events — what's powering the activity feed
    const recentLeads = await prisma.lead.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        source: true,
        status: true,
        propertyId: true,
        createdAt: true,
      },
    });
    console.log("\nRecent leads (top 5):");
    for (const l of recentLeads) {
      const name = [l.firstName, l.lastName].filter(Boolean).join(" ") || "(no name)";
      console.log(
        `  - ${name} · ${l.email ?? "(no email)"} · src=${l.source} · status=${l.status} · propertyId=${l.propertyId ?? "(NULL)"} · ${l.createdAt.toISOString()}`,
      );
    }

    const recentConvos = await prisma.chatbotConversation.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        capturedEmail: true,
        propertyId: true,
        createdAt: true,
        leadId: true,
      },
    });
    console.log("\nRecent chatbot convos (top 5):");
    for (const c of recentConvos) {
      console.log(
        `  - email=${c.capturedEmail ?? "(none)"} · propertyId=${c.propertyId ?? "(NULL)"} · lead=${c.leadId ?? "(unbound)"} · ${c.createdAt.toISOString()}`,
      );
    }
  }
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
