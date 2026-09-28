import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  organization: { findUnique: vi.fn(), updateMany: vi.fn() },
  auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  chatbotConversation: { findFirst: vi.fn() },
  appFolioIntegration: { findFirst: vi.fn() },
  cursiveIntegration: { findFirst: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { applyGoLive } from "@/lib/billing/go-live-trial";

const DAY = 24 * 60 * 60 * 1000;
const signup = new Date("2026-09-01T12:00:00Z");
const at = (d: number) => new Date(signup.getTime() + d * DAY);

const trialOrg = {
  orgType: "CLIENT",
  subscriptionStatus: "TRIALING",
  trialStartedAt: signup,
  trialEndsAt: at(30),
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.organization.findUnique.mockResolvedValue(trialOrg);
  db.auditEvent.findFirst.mockResolvedValue(null);
  db.chatbotConversation.findFirst.mockResolvedValue(null);
  db.appFolioIntegration.findFirst.mockResolvedValue(null);
  db.cursiveIntegration.findFirst.mockResolvedValue(null);
});

describe("applyGoLive", () => {
  it("does nothing before any go-live signal", async () => {
    const snap = await applyGoLive("org1", at(3));
    expect(snap).toEqual({ goLiveAt: null, trialEndsAt: at(30), cardOnFile: false });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("starts the 14-day clock on the first chatbot conversation", async () => {
    db.chatbotConversation.findFirst.mockResolvedValue({ id: "c1" });
    const snap = await applyGoLive("org1", at(3));
    expect(snap?.trialEndsAt).toEqual(at(17));
    expect(db.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org1", subscriptionStatus: "TRIALING", trialEndsAt: at(30) },
      data: { trialEndsAt: at(17) },
    });
    expect(db.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("is idempotent once the marker exists", async () => {
    db.auditEvent.findFirst.mockResolvedValue({ createdAt: at(3) });
    db.chatbotConversation.findFirst.mockResolvedValue({ id: "c1" });
    const snap = await applyGoLive("org1", at(5));
    expect(snap?.goLiveAt).toEqual(at(3));
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("marks go-live but keeps Stripe's date when a card is on file", async () => {
    db.organization.findUnique.mockResolvedValue({
      ...trialOrg,
      currentPeriodEnd: at(30),
    });
    db.cursiveIntegration.findFirst.mockResolvedValue({ id: "p1" });
    const snap = await applyGoLive("org1", at(3));
    expect(snap).toEqual({ goLiveAt: at(3), trialEndsAt: at(30), cardOnFile: true });
    expect(db.organization.updateMany).not.toHaveBeenCalled();
    expect(db.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("ignores paid, canceled, and non-client orgs", async () => {
    for (const org of [
      { ...trialOrg, subscriptionStatus: "ACTIVE" },
      { ...trialOrg, subscriptionStatus: "CANCELED" },
      { ...trialOrg, orgType: "AGENCY" },
    ]) {
      db.organization.findUnique.mockResolvedValue(org);
      expect(await applyGoLive("org1", at(3))).toBeNull();
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not mark an expired trial live", async () => {
    db.organization.findUnique.mockResolvedValue({ ...trialOrg, trialEndsAt: at(14) });
    db.appFolioIntegration.findFirst.mockResolvedValue({ id: "a1" });
    const snap = await applyGoLive("org1", at(15));
    expect(snap?.goLiveAt).toBeNull();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
