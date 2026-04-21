/**
 * scripts/seed-live-chats.ts
 *
 * Seeds 2-3 ChatbotConversation rows with lastMessageAt within the last
 * 5 minutes so the operator portal /portal/visitors "Live chats right now"
 * panel has rows to demo the operator-engage flow against.
 *
 * Idempotent: deletes prior demo "vs_live_chat_*" sessionId rows before
 * re-seeding.
 *
 * Run:
 *   set -a; source .env.local; set +a; \
 *     pnpm exec tsx scripts/seed-live-chats.ts [--org=<slug>]
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import {
  PrismaClient,
  ChatbotConversationStatus,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set. Source .env.local first.");
const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
});

const orgSlug =
  process.argv.find((a) => a.startsWith("--org="))?.split("=")[1] ??
  "telegraph-commons";

const SAMPLE_CHATS = [
  {
    name: "Sarah",
    capturedName: "Sarah",
    capturedEmail: null,
    pageUrl: "https://www.telegraphcommons.com/floor-plans/2-bed",
    minutesAgo: 1,
    messages: [
      { role: "user", content: "Hi, do you have any 2-bed rooms available for fall?" },
      {
        role: "assistant",
        content:
          "Hey! Yes, we have a few 2-bed options opening up for fall move-in. Each room is fully furnished and includes everything from WiFi to weekly cleaning. Want me to walk you through what's available?",
      },
      { role: "user", content: "yes, what's the price range?" },
    ],
  },
  {
    name: "Marcus",
    capturedName: "Marcus",
    capturedEmail: "marcus.l@berkeley.edu",
    pageUrl: "https://www.telegraphcommons.com/amenities",
    minutesAgo: 2,
    messages: [
      { role: "user", content: "is there parking on site?" },
      {
        role: "assistant",
        content:
          "Telegraph Commons doesn't have on-site parking, but most students don't need it. We're 2 blocks from campus and the Berkeley shuttle stops right outside. There's also street parking and nearby garages if you have a car. Are you considering bringing one?",
      },
      { role: "user", content: "no probably not, thanks. what about laundry?" },
      {
        role: "assistant",
        content:
          "Great question! We have a laundry center on site with multiple washers and dryers. It's part of your all-inclusive rent, so no quarters needed. Anything else you'd like to know?",
      },
    ],
  },
  {
    name: null,
    capturedName: null,
    capturedEmail: null,
    pageUrl: "https://www.telegraphcommons.com/",
    minutesAgo: 4,
    messages: [
      { role: "user", content: "how far is it from campus?" },
      {
        role: "assistant",
        content:
          "Telegraph Commons is right at 2490 Channing Way, just 2 blocks from UC Berkeley. About a 3 minute walk to Sproul Plaza. We have a Walk Score of 99. Are you looking to tour anytime soon?",
      },
    ],
  },
];

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new Error(`Org not found: slug=${orgSlug}`);
  console.log(`Seeding live chats for ${org.name} (${org.id})`);

  // Wipe prior demo live chats (sessionId starts with "vs_live_chat_")
  const cleared = await prisma.chatbotConversation.deleteMany({
    where: {
      orgId: org.id,
      sessionId: { startsWith: "vs_live_chat_" },
    },
  });
  if (cleared.count > 0) console.log(`Cleared ${cleared.count} prior demo chats`);

  for (const chat of SAMPLE_CHATS) {
    const lastMessageAt = new Date(Date.now() - chat.minutesAgo * 60_000);
    const messagesWithTimestamps = chat.messages.map((m, i) => ({
      ...m,
      timestamp: new Date(
        lastMessageAt.getTime() - (chat.messages.length - i - 1) * 30_000,
      ).toISOString(),
    }));
    await prisma.chatbotConversation.create({
      data: {
        orgId: org.id,
        sessionId: `vs_live_chat_${randomUUID()}`,
        status: ChatbotConversationStatus.ACTIVE,
        messages: messagesWithTimestamps,
        capturedName: chat.capturedName,
        capturedEmail: chat.capturedEmail,
        messageCount: chat.messages.length,
        lastMessageAt,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
  }

  console.log(`Seeded ${SAMPLE_CHATS.length} live chats. Visit /portal/visitors.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
