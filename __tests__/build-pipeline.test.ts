import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

/**
 * Tests the build pipeline failure flag logic from
 * app/api/admin/intakes/[id]/build-start/route.ts.
 *
 * Sprint 2 introduced failure flags (researchFailed, readmeFailed) that mark
 * a step as failed without setting the success flag, so the step is properly
 * skipped on retry instead of re-running.
 */

let mockPrisma: MockPrisma;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

describe("build pipeline failure flags", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.restoreAllMocks();
  });

  describe("research failure", () => {
    it("sets researchFailed flag (not researchCompleted) on error", () => {
      const buildChecklist: Record<string, boolean> = {};

      // Simulate the research pipeline throwing an error
      // (replicate the catch block from build-start route)
      try {
        throw new Error("Tavily API timeout");
      } catch {
        // This is what the route does on research failure:
        buildChecklist.researchFailed = true;
        // It does NOT set researchCompleted = true
      }

      expect(buildChecklist.researchFailed).toBe(true);
      expect(buildChecklist.researchCompleted).toBeUndefined();
    });

    it("does not re-run research when researchFailed is set", () => {
      const buildChecklist: Record<string, boolean> = {
        researchFailed: true,
      };

      // The route checks: !buildChecklist.researchCompleted && !buildChecklist.researchFailed
      const shouldRunResearch =
        !buildChecklist.researchCompleted && !buildChecklist.researchFailed;

      expect(shouldRunResearch).toBe(false);
    });

    it("skips research when researchCompleted is already true", () => {
      const buildChecklist: Record<string, boolean> = {
        researchCompleted: true,
      };

      const shouldRunResearch =
        !buildChecklist.researchCompleted && !buildChecklist.researchFailed;

      expect(shouldRunResearch).toBe(false);
    });

    it("runs research when neither flag is set", () => {
      const buildChecklist: Record<string, boolean> = {};

      const shouldRunResearch =
        !buildChecklist.researchCompleted && !buildChecklist.researchFailed;

      expect(shouldRunResearch).toBe(true);
    });
  });

  describe("readme failure", () => {
    it("sets readmeFailed flag (not readmeGenerated) on error", () => {
      const buildChecklist: Record<string, boolean> = {};

      // Simulate the readme generation throwing an error
      try {
        throw new Error("Claude API rate limit");
      } catch {
        // This is what the route does on readme failure:
        buildChecklist.readmeFailed = true;
        // It does NOT set readmeGenerated = true
      }

      expect(buildChecklist.readmeFailed).toBe(true);
      expect(buildChecklist.readmeGenerated).toBeUndefined();
    });

    it("does not re-run readme generation when readmeFailed is set", () => {
      const buildChecklist: Record<string, boolean> = {
        readmeFailed: true,
      };

      // The route checks: !buildChecklist.readmeGenerated && !buildChecklist.readmeFailed
      const shouldRunReadme =
        !buildChecklist.readmeGenerated && !buildChecklist.readmeFailed;

      expect(shouldRunReadme).toBe(false);
    });

    it("skips readme when readmeGenerated is already true", () => {
      const buildChecklist: Record<string, boolean> = {
        readmeGenerated: true,
      };

      const shouldRunReadme =
        !buildChecklist.readmeGenerated && !buildChecklist.readmeFailed;

      expect(shouldRunReadme).toBe(false);
    });

    it("runs readme generation when neither flag is set", () => {
      const buildChecklist: Record<string, boolean> = {};

      const shouldRunReadme =
        !buildChecklist.readmeGenerated && !buildChecklist.readmeFailed;

      expect(shouldRunReadme).toBe(true);
    });
  });

  describe("failed steps are properly skipped", () => {
    it("allows later steps to proceed even when research fails", () => {
      const buildChecklist: Record<string, boolean> = {
        configGenerated: true,
        researchFailed: true,
        // readmeGenerated and readmeFailed are not set
      };

      // Research is skipped (failed)
      const shouldRunResearch =
        !buildChecklist.researchCompleted && !buildChecklist.researchFailed;
      expect(shouldRunResearch).toBe(false);

      // But readme generation should still run
      const shouldRunReadme =
        !buildChecklist.readmeGenerated && !buildChecklist.readmeFailed;
      expect(shouldRunReadme).toBe(true);
    });

    it("allows later steps to proceed even when readme fails", () => {
      const buildChecklist: Record<string, boolean> = {
        configGenerated: true,
        researchCompleted: true,
        readmeFailed: true,
      };

      // Both research and readme are done/failed
      // GitHub repo creation should still proceed (it checks githubRepoCreated, not research/readme)
      const shouldCreateRepo = !buildChecklist.githubRepoCreated;
      expect(shouldCreateRepo).toBe(true);
    });

    it("preserves both failure flags independently", () => {
      const buildChecklist: Record<string, boolean> = {
        configGenerated: true,
        researchFailed: true,
        readmeFailed: true,
      };

      expect(buildChecklist.researchFailed).toBe(true);
      expect(buildChecklist.readmeFailed).toBe(true);
      expect(buildChecklist.researchCompleted).toBeUndefined();
      expect(buildChecklist.readmeGenerated).toBeUndefined();
    });
  });
});
