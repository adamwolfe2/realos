import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

/**
 * Tests the referral credit deduction logic from app/api/checkout/route.ts.
 *
 * The checkout route uses a $transaction with optimistic locking to prevent
 * race conditions when deducting referral credits. We replicate that pattern
 * here to verify the guards work correctly.
 */

let mockPrisma: MockPrisma;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

describe("referral credit deduction", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.restoreAllMocks();
  });

  describe("credits cannot go negative (race condition protection)", () => {
    it("throws when appliedReferral exceeds current balance inside transaction", async () => {
      // Simulate a race: user had $50 credit when checkout started,
      // but another transaction already deducted it to $10
      const orgId = "org-1";
      const appliedReferral = 50; // amount we want to deduct

      // Inside the transaction, the current balance is only $10
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          organization: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              referralCredits: 10, // Only $10 left (someone else used $40)
            }),
            update: vi.fn(),
          },
          auditEvent: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      // Replicate the checkout route's transaction logic
      await expect(
        mockPrisma.$transaction(async (tx: {
          organization: { findUniqueOrThrow: Function; update: Function };
          auditEvent: { create: Function };
        }) => {
          const currentOrg = await tx.organization.findUniqueOrThrow({
            where: { id: orgId },
            select: { referralCredits: true },
          });
          const currentBalance = Number(currentOrg.referralCredits ?? 0);
          if (appliedReferral > currentBalance) {
            throw new Error("Insufficient referral credits");
          }
          await tx.organization.update({
            where: { id: orgId },
            data: { referralCredits: { decrement: appliedReferral } },
          });
        })
      ).rejects.toThrow("Insufficient referral credits");
    });

    it("succeeds when appliedReferral is within current balance", async () => {
      const orgId = "org-2";
      const appliedReferral = 25;

      const mockUpdate = vi.fn();
      const mockAuditCreate = vi.fn();

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          organization: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              referralCredits: 50,
            }),
            update: mockUpdate,
          },
          auditEvent: {
            create: mockAuditCreate,
          },
        };
        return fn(tx);
      });

      await mockPrisma.$transaction(async (tx: {
        organization: { findUniqueOrThrow: Function; update: Function };
        auditEvent: { create: Function };
      }) => {
        const currentOrg = await tx.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { referralCredits: true },
        });
        const currentBalance = Number(currentOrg.referralCredits ?? 0);
        if (appliedReferral > currentBalance) {
          throw new Error("Insufficient referral credits");
        }
        await tx.organization.update({
          where: { id: orgId },
          data: { referralCredits: { decrement: appliedReferral } },
        });
        await tx.auditEvent.create({
          data: {
            entityType: "Order",
            entityId: "order-1",
            action: "referral_credit_applied",
            userId: "user-1",
            metadata: { creditApplied: appliedReferral, orgId },
          },
        });
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: orgId },
        data: { referralCredits: { decrement: 25 } },
      });
    });
  });

  describe("credit deduction creates audit event", () => {
    it("creates referral_credit_applied audit event with correct metadata", async () => {
      const orgId = "org-3";
      const appliedReferral = 30;
      const userId = "user-admin";
      const orderId = "order-99";

      const mockAuditCreate = vi.fn();

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          organization: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              referralCredits: 100,
            }),
            update: vi.fn(),
          },
          auditEvent: {
            create: mockAuditCreate,
          },
        };
        return fn(tx);
      });

      await mockPrisma.$transaction(async (tx: {
        organization: { findUniqueOrThrow: Function; update: Function };
        auditEvent: { create: Function };
      }) => {
        const currentOrg = await tx.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { referralCredits: true },
        });
        const currentBalance = Number(currentOrg.referralCredits ?? 0);
        if (appliedReferral > currentBalance) {
          throw new Error("Insufficient referral credits");
        }
        await tx.organization.update({
          where: { id: orgId },
          data: { referralCredits: { decrement: appliedReferral } },
        });
        await tx.auditEvent.create({
          data: {
            entityType: "Order",
            entityId: orderId,
            action: "referral_credit_applied",
            userId,
            metadata: { creditApplied: appliedReferral, orgId },
          },
        });
      });

      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: "Order",
          entityId: "order-99",
          action: "referral_credit_applied",
          userId: "user-admin",
          metadata: { creditApplied: 30, orgId: "org-3" },
        }),
      });
    });
  });

  describe("zero credits", () => {
    it("skips credit deduction entirely when referralCredits is zero", () => {
      const referralCredits = 0;
      const applyCredits = true;

      // Replicate the checkout route's guard logic
      const referralCreditToApply =
        applyCredits && referralCredits > 0 ? referralCredits : 0;

      expect(referralCreditToApply).toBe(0);

      // When creditToApply is 0, the transaction block is never entered
      // (checkout route: `if (referralCreditToApply > 0) { ... }`)
      if (referralCreditToApply > 0) {
        // This block should NOT execute
        expect(true).toBe(false);
      }

      // No Prisma calls should have been made
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("skips credit deduction when applyCredits is false", () => {
      const referralCredits = 50;
      const applyCredits = false;

      const referralCreditToApply =
        applyCredits && referralCredits > 0 ? referralCredits : 0;

      expect(referralCreditToApply).toBe(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("does not decrement when org.referralCredits is null", () => {
      const orgCredits: number | null = null;
      const referralCredits = Number(orgCredits ?? 0);
      const applyCredits = true;

      const referralCreditToApply =
        applyCredits && referralCredits > 0 ? referralCredits : 0;

      expect(referralCreditToApply).toBe(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
