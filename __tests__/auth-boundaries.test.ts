import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

let mockPrisma: MockPrisma;
const mockAuth = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

const { requireAdmin, requireAdminOrRep } = await import(
  "@/lib/auth/require-admin"
);

describe("auth boundaries", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.restoreAllMocks();
    mockAuth.mockReset();
  });

  describe("requireAdmin", () => {
    it("returns 401 when no userId (unauthenticated)", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const result = await requireAdmin();

      expect(result.error).not.toBeNull();
      expect(result.userId).toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 403 when user is not an agency admin role", async () => {
      mockAuth.mockResolvedValue({ userId: "user-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "CLIENT_OWNER" });

      const result = await requireAdmin();

      expect(result.error).not.toBeNull();
      expect(result.userId).toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe("Forbidden");
    });

    it("returns 403 when user does not exist in database", async () => {
      mockAuth.mockResolvedValue({ userId: "user-nonexistent" });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await requireAdmin();

      expect(result.error).not.toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe("Forbidden");
    });

    // Audit P1-1 (2026-07-31): these tests previously mocked "ADMIN"/"OPS"
    // — role strings that don't exist in the UserRole enum — which masked
    // the fact that every real user was 403'd. Real enum values only.
    it("returns userId and null error for AGENCY_OWNER role", async () => {
      mockAuth.mockResolvedValue({ userId: "admin-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "AGENCY_OWNER" });

      const result = await requireAdmin();

      expect(result.error).toBeNull();
      expect(result.userId).toBe("admin-1");
    });

    it("returns userId and null error for AGENCY_ADMIN role", async () => {
      mockAuth.mockResolvedValue({ userId: "ops-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "AGENCY_ADMIN" });

      const result = await requireAdmin();

      expect(result.error).toBeNull();
      expect(result.userId).toBe("ops-1");
    });

    it("rejects AGENCY_OPERATOR role", async () => {
      mockAuth.mockResolvedValue({ userId: "rep-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "AGENCY_OPERATOR" });

      const result = await requireAdmin();

      expect(result.error).not.toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe("Forbidden");
    });
  });

  describe("requireAdminOrRep", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const result = await requireAdminOrRep();

      expect(result.error).not.toBeNull();
      expect(result.userId).toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("allows AGENCY_OWNER role", async () => {
      mockAuth.mockResolvedValue({ userId: "admin-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "AGENCY_OWNER" });

      const result = await requireAdminOrRep();

      expect(result.error).toBeNull();
      expect(result.userId).toBe("admin-1");
    });

    it("allows AGENCY_ADMIN role", async () => {
      mockAuth.mockResolvedValue({ userId: "ops-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "AGENCY_ADMIN" });

      const result = await requireAdminOrRep();

      expect(result.error).toBeNull();
      expect(result.userId).toBe("ops-1");
    });

    it("allows AGENCY_OPERATOR role", async () => {
      mockAuth.mockResolvedValue({ userId: "rep-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "AGENCY_OPERATOR" });

      const result = await requireAdminOrRep();

      expect(result.error).toBeNull();
      expect(result.userId).toBe("rep-1");
    });

    it("rejects CLIENT role", async () => {
      mockAuth.mockResolvedValue({ userId: "client-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "CLIENT" });

      const result = await requireAdminOrRep();

      expect(result.error).not.toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe("Forbidden");
    });

    it("rejects unknown roles", async () => {
      mockAuth.mockResolvedValue({ userId: "user-1" });
      mockPrisma.user.findUnique.mockResolvedValue({ role: "VIEWER" });

      const result = await requireAdminOrRep();

      expect(result.error).not.toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe("Forbidden");
    });
  });
});
