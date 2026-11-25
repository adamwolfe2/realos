import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const DAY = 86_400_000;
const now = Date.now();
const ago = (d: number) => new Date(now - d * DAY);

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findMany: vi.fn(async () => [
        { id: "a", name: "Alpha", chatbotConfig: { chatbotEnabled: true } },
        { id: "b", name: "Beta", chatbotConfig: null },
      ]),
    },
    listing: {
      findMany: vi.fn(async () => [
        { propertyId: "a", unitNumber: "101", unitType: null, raw: {}, listedAt: ago(40), availableFrom: null },
        { propertyId: "a", unitNumber: "Prelease 2B 2027-2028", unitType: null, raw: {}, listedAt: ago(90), availableFrom: null },
        { propertyId: "b", unitNumber: "202", unitType: null, raw: {}, listedAt: null, availableFrom: ago(400) },
        { propertyId: "b", unitNumber: "Parking 3", unitType: null, raw: {}, listedAt: ago(90), availableFrom: null },
      ]),
    },
    seoSnapshot: { groupBy: vi.fn(async () => [{ propertyId: "a", _sum: { organicSessions: 120, totalClicks: 80 } }]) },
    lead: { groupBy: vi.fn(async () => []) },
    seoIntegration: { findMany: vi.fn(async () => [{ propertyId: "a", provider: "GA4", lastSyncError: null }]) },
    seoQuery: {
      findMany: vi.fn(async () => [
        { propertyId: "a", query: "alpha apartments", date: ago(3), impressions: 40, position: 8 },
        { propertyId: "a", query: "alpha apartments", date: ago(40), impressions: 40, position: 3 },
      ]),
    },
    chatbotConversation: {
      findMany: vi.fn(async () => [
        { propertyId: "a", messages: [{ role: "user", content: "pets?" }, { role: "assistant", content: "I don't have that in front of me." }] },
      ]),
    },
    chatbotKnowledgeSuggestion: { findMany: vi.fn(async () => []) },
  },
}));

import { getNeedsAttention } from "@/lib/portal/needs-attention";

describe("getNeedsAttention", () => {
  it("ranks real issues and labels the ready-date fallback", async () => {
    const items = await getNeedsAttention("org", null, { state: "failed", lastError: "401 bad credentials" } as never);
    expect(items.map((i) => i.kind)).toEqual(["sync", "stale-units", "traffic-no-leads", "stale-units", "unanswered", "rank-drop", "missing-source", "missing-source"]);
    const listed = items.find((i) => i.id === "listed:a")!;
    expect(listed.title).toBe("1 unit listed 30+ days"); // pre-lease left out
    expect(listed.href).toBe("/portal/properties/a#units");
    const ready = items.find((i) => i.id === "ready:portfolio")!;
    expect(ready.title).toBe("1 unit past its ready-for-showing date by 60+ days"); // parking left out
    expect(items.find((i) => i.kind === "rank-drop")!.detail).toBe('"alpha apartments" 3.0 → 8.0');
    expect(items.find((i) => i.id === "missing:Chatbot")!.detail).toBe("Beta");
  });
});
