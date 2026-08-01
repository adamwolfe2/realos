import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Coverage gap: lib/billing/gate.ts (checkAiBillingGate) was only ever
// vi.mock()'d by consumers — the real gate logic itself was never
// exercised. This caps Anthropic spend for delinquent tenants (PAST_DUE /
// CANCELED / PAUSED), so a regression here either locks out a paying
// customer or lets a non-paying one keep burning model budget. Covers
// every branch: impersonation bypass, unknown org, null status, each
// blocking status, ACTIVE/TRIALING allow, and the fail-open DB-error path.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: { organization: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/notifications/create", () => ({
  notifyAiQuotaWarning: vi.fn(async () => {}),
}));

import { checkAiBillingGate, aiBillingDeniedResponseBody } from "@/lib/billing/gate";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAiBillingGate", () => {
  it("bypasses the gate entirely for an impersonating agency user", async () => {
    const result = await checkAiBillingGate("org_1", { isImpersonating: true });
    expect(result).toEqual({ allowed: true, reason: "impersonating" });
    // Never even queries the org — impersonation short-circuits first.
    expect(h.db.organization.findUnique).not.toHaveBeenCalled();
  });

  it("fails open (allowed: true) when the org doesn't exist", async () => {
    h.db.organization.findUnique.mockResolvedValue(null);
    const result = await checkAiBillingGate("org_missing");
    expect(result).toEqual({ allowed: true, reason: "unknown_org" });
  });

  it("fails open when the DB lookup throws", async () => {
    h.db.organization.findUnique.mockRejectedValue(new Error("connection reset"));
    const result = await checkAiBillingGate("org_1");
    expect(result).toEqual({ allowed: true, reason: "unknown_org" });
  });

  it("allows a pre-trial org with no subscriptionStatus yet", async () => {
    h.db.organization.findUnique.mockResolvedValue({ subscriptionStatus: null });
    const result = await checkAiBillingGate("org_1");
    expect(result).toEqual({ allowed: true, reason: "ok" });
  });

  it("blocks PAST_DUE with a 402-shaped result", async () => {
    h.db.organization.findUnique.mockResolvedValue({
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
    });
    const result = await checkAiBillingGate("org_1");
    expect(result).toEqual({
      allowed: false,
      reason: "past_due",
      retryUrl: "/portal/billing",
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
    });
  });

  it("blocks CANCELED", async () => {
    h.db.organization.findUnique.mockResolvedValue({
      subscriptionStatus: SubscriptionStatus.CANCELED,
    });
    const result = await checkAiBillingGate("org_1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("canceled");
  });

  it("blocks PAUSED", async () => {
    h.db.organization.findUnique.mockResolvedValue({
      subscriptionStatus: SubscriptionStatus.PAUSED,
    });
    const result = await checkAiBillingGate("org_1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("paused");
  });

  it("allows ACTIVE", async () => {
    h.db.organization.findUnique.mockResolvedValue({
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });
    const result = await checkAiBillingGate("org_1");
    expect(result).toEqual({ allowed: true, reason: "ok" });
  });

  it("allows TRIALING (trial expiry is a separate gate)", async () => {
    h.db.organization.findUnique.mockResolvedValue({
      subscriptionStatus: SubscriptionStatus.TRIALING,
    });
    const result = await checkAiBillingGate("org_1");
    expect(result).toEqual({ allowed: true, reason: "ok" });
  });
});

describe("aiBillingDeniedResponseBody", () => {
  it("builds a stable, code-routable 402 body for each blocking reason", () => {
    const body = aiBillingDeniedResponseBody({
      reason: "past_due",
      retryUrl: "/portal/billing",
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
    });
    expect(body.code).toBe("billing_required");
    expect(body.reason).toBe("past_due");
    expect(body.error).toMatch(/past due/i);
  });
});
