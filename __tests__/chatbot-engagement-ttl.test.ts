import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngagementStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Stale-engagement TTL (lib/chatbot/expire-stale-engagements.ts, piggybacked
// on the chatbot-profile-digest cron). A PENDING ChatbotEngagement means the
// widget hasn't polled it yet — after 24h that almost certainly means the
// visitor's tab is gone, so the row should read as EXPIRED instead of
// implying the message is still in flight forever.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    chatbotEngagement: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));

import { expireStaleEngagements } from "@/lib/chatbot/expire-stale-engagements";

beforeEach(() => {
  vi.clearAllMocks();
  h.db.chatbotEngagement.updateMany.mockResolvedValue({ count: 0 });
});

describe("expireStaleEngagements", () => {
  it("flips PENDING rows older than 24h to EXPIRED via a single bounded updateMany", async () => {
    h.db.chatbotEngagement.updateMany.mockResolvedValue({ count: 3 });
    const now = new Date("2026-08-01T12:00:00.000Z");

    const result = await expireStaleEngagements(now);

    expect(h.db.chatbotEngagement.updateMany).toHaveBeenCalledTimes(1);
    expect(h.db.chatbotEngagement.updateMany).toHaveBeenCalledWith({
      where: {
        status: EngagementStatus.PENDING,
        createdAt: { lt: new Date("2026-07-31T12:00:00.000Z") },
      },
      data: { status: EngagementStatus.EXPIRED },
    });
    expect(result).toEqual({ expiredCount: 3 });
  });

  it("only ever issues one updateMany call (no row fetch, no per-row loop)", async () => {
    await expireStaleEngagements(new Date("2026-08-01T00:00:00.000Z"));

    expect(h.db.chatbotEngagement.updateMany).toHaveBeenCalledTimes(1);
    // The where clause never targets DELIVERED/DISMISSED/REPLIED — only a
    // PENDING row can go stale this way.
    const call = h.db.chatbotEngagement.updateMany.mock.calls[0][0];
    expect(call.where.status).toBe(EngagementStatus.PENDING);
  });

  it("returns expiredCount 0 with no rows past the cutoff", async () => {
    h.db.chatbotEngagement.updateMany.mockResolvedValue({ count: 0 });

    const result = await expireStaleEngagements(new Date());

    expect(result.expiredCount).toBe(0);
  });
});
