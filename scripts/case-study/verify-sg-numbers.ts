// Recompute every SG Real Estate case-study number from the database and
// compare it to the frozen constants in lib/case-study/sg-real-estate.ts.
//
// READ-ONLY. It refuses to run unless the session reports
// default_transaction_read_only = on, and it only calls
// generateReportSnapshot (skipAi, no persist) plus read-only counts.
//
//   NODE_OPTIONS="--conditions=react-server" \
//     pnpm exec tsx --env-file=.env.local scripts/case-study/verify-sg-numbers.ts
//
// Exit 0 when every number matches, 1 on any FAIL.

import {
  ChatbotConversationStatus,
  LeadSource,
  LeadStatus,
} from "@prisma/client";
import { getPrisma } from "../../lib/db";
import { generateReportSnapshot } from "../../lib/reports/generate";
import { SG_CASE_STUDY as CS } from "../../lib/case-study/sg-real-estate";

async function assertReadOnly(): Promise<void> {
  const rows = await getPrisma().$queryRaw<
    Array<{ default_transaction_read_only: string }>
  >`SHOW default_transaction_read_only`;
  if (rows[0]?.default_transaction_read_only !== "on") {
    throw new Error(
      "Refusing to run: DATABASE_URL session is not read-only " +
        "(expected default_transaction_read_only = on).",
    );
  }
}

async function main(): Promise<void> {
  await assertReadOnly();
  const periodStart = new Date(CS.period.start);
  const periodEnd = new Date(CS.period.end);

  // The client report's own code, same window and scope as the report
  // SG Real Estate was sent.
  const snap = await generateReportSnapshot(CS.orgId, "custom", {
    period: { periodStart, periodEnd },
    skipAi: true,
  });

  const db = getPrisma();
  const inWindow = { gte: periodStart, lt: periodEnd };
  const activeLead = { orgId: CS.orgId, property: { lifecycle: "ACTIVE" as const } };
  // Same scope as the report's chatbot stats (buildChatbotExtended).
  const convScope = {
    orgId: CS.orgId,
    OR: [{ propertyId: null }, { property: { lifecycle: "ACTIVE" as const } }],
  };
  // tracedSignedLeads, exactly as lib/reports/generate.ts counts it.
  const traced = {
    ...activeLead,
    residents: { some: {} },
    status: LeadStatus.SIGNED,
    convertedAt: inWindow,
  };
  const day = (d: Date | undefined) => d?.toISOString().slice(0, 10);

  const [
    firstConv,
    firstLead,
    firstAppfolio,
    chatbotLeadRows,
    propertyInbox,
    preChatCaptures,
    withMessages,
    capturedWithMessages,
    tracedAtProperty,
    chatbotTraced,
    chatbotTracedPreChat,
  ] = await Promise.all([
    db.chatbotConversation.findFirst({
      where: convScope,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.lead.findFirst({
      where: activeLead,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.lead.findFirst({
      where: { ...activeLead, sourceDetail: "AppFolio application" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.lead.findMany({
      where: { ...activeLead, source: LeadSource.CHATBOT, createdAt: inWindow },
      select: { email: true },
    }),
    db.lead.count({
      where: {
        ...activeLead,
        source: LeadSource.CHATBOT,
        createdAt: inWindow,
        email: { endsWith: "@telegraphcommons.com", mode: "insensitive" },
      },
    }),
    db.chatbotConversation.count({
      where: {
        ...convScope,
        createdAt: inWindow,
        status: ChatbotConversationStatus.LEAD_CAPTURED,
        messageCount: { lte: 1 },
      },
    }),
    db.chatbotConversation.count({
      where: { ...convScope, createdAt: inWindow, messageCount: { gt: 1 } },
    }),
    db.chatbotConversation.count({
      where: {
        ...convScope,
        createdAt: inWindow,
        status: ChatbotConversationStatus.LEAD_CAPTURED,
        messageCount: { gt: 1 },
      },
    }),
    db.lead.count({
      where: {
        ...traced,
        residents: { some: { property: { lifecycle: "ACTIVE" } } },
      },
    }),
    db.lead.count({ where: { ...traced, source: LeadSource.CHATBOT } }),
    db.lead.count({
      where: {
        ...traced,
        source: LeadSource.CHATBOT,
        sourceDetail: "chatbot:pre_chat",
      },
    }),
  ]);
  const distinctEmails = new Set(
    chatbotLeadRows.flatMap((r) => (r.email ? [r.email.toLowerCase()] : [])),
  ).size;

  const checks: Array<[string, unknown, unknown]> = [
    ["firstRecords.conversation", CS.firstRecords.conversation, day(firstConv?.createdAt)],
    ["firstRecords.lead", CS.firstRecords.lead, day(firstLead?.createdAt)],
    [
      "firstRecords.appfolioApplication",
      CS.firstRecords.appfolioApplication,
      day(firstAppfolio?.createdAt),
    ],
    ["leads", CS.leads, snap.kpis.leads],
    ["chatbotLeads", CS.chatbotLeads, snap.chatbotStats?.leadsFromChat],
    ["chatbotLeads (rows)", CS.chatbotLeads, chatbotLeadRows.length],
    ["chatbotLeadEmails", CS.chatbotLeadEmails, distinctEmails],
    ["chatbotLeadsFromPropertyInbox", CS.chatbotLeadsFromPropertyInbox, propertyInbox],
    [
      "chatbotConversations",
      CS.chatbotConversations,
      snap.chatbotStats?.conversations,
    ],
    [
      "chatbotCapturedConversations",
      CS.chatbotCapturedConversations,
      snap.chatbotStatsExtended?.capturedConversations,
    ],
    ["chatbotPreChatCaptures", CS.chatbotPreChatCaptures, preChatCaptures],
    [
      "chatbotConversationsWithMessages",
      CS.chatbotConversationsWithMessages,
      withMessages,
    ],
    ["chatbotCapturedWithMessages", CS.chatbotCapturedWithMessages, capturedWithMessages],
    [
      "captured = preChat + withMessages",
      CS.chatbotCapturedConversations,
      CS.chatbotPreChatCaptures + CS.chatbotCapturedWithMessages,
    ],
    ["tracedSignedLeases", CS.tracedSignedLeases, snap.tracedSignedLeads],
    ["tracedAtProperty", CS.tracedAtProperty, tracedAtProperty],
    ["chatbotTracedSignedLeases", CS.chatbotTracedSignedLeases, chatbotTraced],
    [
      "chatbotTracedSignedLeases (pre_chat)",
      CS.chatbotTracedSignedLeases,
      chatbotTracedPreChat,
    ],
  ];

  checks.push(...(await sinceLaunchChecks()));

  console.log(
    `SG case study verify @ ${new Date().toISOString()} ` +
      `(constants as of ${CS.asOf}, window ${CS.period.start} to ${CS.period.end})`,
  );
  let failed = 0;
  for (const [name, expected, actual] of checks) {
    const ok = actual === expected;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name.padEnd(38)} constant=${expected} db=${actual ?? "missing"}`,
    );
  }
  console.log(failed === 0 ? "ALL PASS" : `${failed} FAIL`);
  process.exitCode = failed === 0 ? 0 : 1;
}

// Since-launch numbers (2026-10-30 page rewrite). Raw read-only SQL; the
// definitions are documented on SG_CASE_STUDY.sinceLaunch.
async function sinceLaunchChecks(): Promise<Array<[string, unknown, unknown]>> {
  const SL = CS.sinceLaunch;
  const db = getPrisma();
  const start = new Date(SL.start);
  const end = new Date(SL.end);
  const org = CS.orgId;
  const prop = CS.propertyId;
  const n = (v: unknown) => (v == null ? null : Number(v));

  const [leads] = await db.$queryRaw<Array<Record<string, bigint>>>`
    SELECT count(*) AS total,
      count(*) FILTER (WHERE source = 'CHATBOT') AS chatbot,
      count(*) FILTER (WHERE source = 'OTHER' AND "sourceDetail" = 'AppFolio application') AS appfolio,
      count(*) FILTER (WHERE source = 'FORM') AS form
    FROM "Lead" WHERE "orgId" = ${org}
      AND ("propertyId" = ${prop} OR "propertyId" IS NULL)
      AND "createdAt" >= ${start} AND "createdAt" < ${end}`;
  const [chats] = await db.$queryRaw<Array<Record<string, bigint>>>`
    SELECT count(*) AS total, count(*) FILTER (WHERE status = 'LEAD_CAPTURED') AS captured
    FROM "ChatbotConversation" WHERE "orgId" = ${org}
      AND ("propertyId" = ${prop} OR "propertyId" IS NULL)
      AND "createdAt" >= ${start} AND "createdAt" < ${end}`;
  const [traced] = await db.$queryRaw<Array<Record<string, unknown>>>`
    WITH x AS (
      SELECT DISTINCT ON (l.id) l.id, l.source, l."createdAt" AS lead_at,
        ls."startDate", ls."monthlyRentCents" AS rent
      FROM "Lead" l
      JOIN "Resident" r ON r."leadId" = l.id AND r."propertyId" = ${prop}
      JOIN "Lease" ls ON ls."residentId" = r.id
      WHERE l."orgId" = ${org} AND l.status = 'SIGNED'
        AND ls."startDate" >= ${start} AND ls."startDate" < ${end}
        AND l."createdAt" <= ls."startDate"
      ORDER BY l.id, ls."startDate" DESC)
    SELECT count(*) AS leases,
      count(*) FILTER (WHERE source = 'CHATBOT') AS chat_leases,
      round(sum(rent) * 12 / 100.0) AS annual,
      round(sum(rent) FILTER (WHERE source = 'CHATBOT') * 12 / 100.0) AS chat_annual,
      round(avg(extract(epoch FROM ("startDate" - lead_at)) / 86400)
        FILTER (WHERE source = 'CHATBOT')) AS chat_days
    FROM x`;
  const [synced] = await db.$queryRaw<Array<Record<string, bigint>>>`
    SELECT (SELECT count(*) FROM "Resident" WHERE "orgId" = ${org} AND "propertyId" = ${prop}) AS residents,
      (SELECT count(*) FROM "Lease" WHERE "orgId" = ${org} AND "propertyId" = ${prop}) AS leases`;
  const search = await db.$queryRaw<Array<Record<string, unknown>>>`
    SELECT to_char(date, 'YYYY-MM') AS m, sum("totalClicks") AS clicks,
      sum("totalImpressions") AS impr, round(avg("avgPosition")::numeric, 1) AS pos
    FROM "SeoSnapshot" WHERE "orgId" = ${org} AND date >= ${start}
      AND date < ${new Date(SL.searchEndDate)}
    GROUP BY 1 ORDER BY 1`;
  const tracedMonthly = await db.$queryRaw<Array<Record<string, unknown>>>`
    WITH x AS (
      SELECT DISTINCT ON (l.id) l.id, ls."startDate"
      FROM "Lead" l
      JOIN "Resident" r ON r."leadId" = l.id AND r."propertyId" = ${prop}
      JOIN "Lease" ls ON ls."residentId" = r.id
      WHERE l."orgId" = ${org} AND l.status = 'SIGNED'
        AND ls."startDate" >= ${start} AND ls."startDate" < ${end}
        AND l."createdAt" <= ls."startDate"
      ORDER BY l.id, ls."startDate" DESC)
    SELECT to_char("startDate", 'YYYY-MM') AS m, count(*) AS n FROM x GROUP BY 1`;
  const monthly = await db.$queryRaw<Array<Record<string, unknown>>>`
    WITH l AS (
      SELECT to_char("createdAt", 'YYYY-MM') AS m,
        count(*) FILTER (WHERE source = 'CHATBOT') AS chatbot,
        count(*) FILTER (WHERE source = 'OTHER' AND "sourceDetail" = 'AppFolio application') AS appfolio,
        count(*) FILTER (WHERE source = 'FORM') AS form
      FROM "Lead" WHERE "orgId" = ${org}
        AND ("propertyId" = ${prop} OR "propertyId" IS NULL)
        AND "createdAt" >= ${start} AND "createdAt" < ${end} GROUP BY 1),
    c AS (
      SELECT to_char("createdAt", 'YYYY-MM') AS m, count(*) AS chats
      FROM "ChatbotConversation" WHERE "orgId" = ${org}
        AND ("propertyId" = ${prop} OR "propertyId" IS NULL)
        AND "createdAt" >= ${start} AND "createdAt" < ${end} GROUP BY 1)
    SELECT coalesce(l.m, c.m) AS m, coalesce(chatbot, 0) AS chatbot,
      coalesce(appfolio, 0) AS appfolio, coalesce(form, 0) AS form,
      coalesce(chats, 0) AS chats
    FROM l FULL JOIN c ON c.m = l.m ORDER BY 1`;

  const monthlyDb = JSON.stringify(
    monthly.map((r) => ({
      month: r.m,
      chatbot: n(r.chatbot),
      appfolio: n(r.appfolio),
      webForm: n(r.form),
      chats: n(r.chats),
      leasesTraced: n(tracedMonthly.find((t) => t.m === r.m)?.n) ?? 0,
      searchClicks: n(search.find((t) => t.m === r.m)?.clicks) ?? 0,
      searchPosition: n(search.find((t) => t.m === r.m)?.pos) ?? 0,
    })),
  );
  return [
    ["sinceLaunch.leads", SL.leads, n(leads?.total)],
    ["sinceLaunch.leadsFromChatbot", SL.leadsFromChatbot, n(leads?.chatbot)],
    ["sinceLaunch.leadsFromAppfolioApplications", SL.leadsFromAppfolioApplications, n(leads?.appfolio)],
    ["sinceLaunch.leadsFromWebForm", SL.leadsFromWebForm, n(leads?.form)],
    ["sinceLaunch.chatSessions", SL.chatSessions, n(chats?.total)],
    ["sinceLaunch.chatSessionsCaptured", SL.chatSessionsCaptured, n(chats?.captured)],
    ["sinceLaunch.tracedLeases", SL.tracedLeases, n(traced?.leases)],
    ["sinceLaunch.tracedLeasesFromChat", SL.tracedLeasesFromChat, n(traced?.chat_leases)],
    ["sinceLaunch.tracedAnnualRentUsd", SL.tracedAnnualRentUsd, n(traced?.annual)],
    ["sinceLaunch.tracedAnnualRentFromChatUsd", SL.tracedAnnualRentFromChatUsd, n(traced?.chat_annual)],
    ["sinceLaunch.avgDaysChatToLeaseStart", SL.avgDaysChatToLeaseStart, n(traced?.chat_days)],
    ["sinceLaunch.residentsSynced", SL.residentsSynced, n(synced?.residents)],
    ["sinceLaunch.leasesSynced", SL.leasesSynced, n(synced?.leases)],
    ["sinceLaunch.searchClicks", SL.searchClicks, search.reduce((a, r) => a + Number(r.clicks), 0)],
    ["sinceLaunch.searchImpressions", SL.searchImpressions, search.reduce((a, r) => a + Number(r.impr), 0)],
    ["sinceLaunch.searchPositionFirstMonth", SL.searchPositionFirstMonth, n(search[0]?.pos)],
    ["sinceLaunch.searchPositionLatestMonth", SL.searchPositionLatestMonth, n(search.at(-1)?.pos)],
    ["sinceLaunch.monthly", JSON.stringify(SL.monthly), monthlyDb],
  ];
}

main()
  .catch((err) => {
    console.error("[verify-sg-numbers] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
