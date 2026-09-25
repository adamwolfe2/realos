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

  const checks: Array<[string, number | string, number | string | undefined]> = [
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

main()
  .catch((err) => {
    console.error("[verify-sg-numbers] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
