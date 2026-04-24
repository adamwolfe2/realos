import "server-only";
import { prisma } from "@/lib/db";
import {
  SETUP_STEPS,
  PHASE_ORDER,
  type SetupStepDefinition,
  type SetupCheckContext,
  type SetupPhase,
} from "./steps";

// ---------------------------------------------------------------------------
// deriveSetupProgress
//
// Loads the org + its setup-related sub-resources, evaluates every step's
// isComplete predicate, and returns a display-ready structure for the Setup
// Hub page. One status per step:
//
//   done     — isComplete returned true
//   locked   — step requires a module that's currently disabled on the org
//   current  — the first non-done, non-locked step in timeline order
//   pending  — everything else
//
// daysToLaunch is a coarse signal, not a real date. It drops two days for
// each Foundation step that's done, clamped to [0, 14]. It's meant for the
// hero subtitle ("~9 days to launch") — directional, not contractual.
// ---------------------------------------------------------------------------

export type SetupStepStatus = "done" | "current" | "pending" | "locked";

export type ResolvedSetupStep = SetupStepDefinition & {
  status: SetupStepStatus;
};

export type SetupProgress = {
  steps: ResolvedSetupStep[];
  completedCount: number;
  totalCount: number;
  foundationComplete: boolean;
  phase: SetupPhase | "done";
  daysToLaunch: number;
  org: {
    id: string;
    name: string;
    onboardingDismissed: boolean;
  };
};

export async function deriveSetupProgress(orgId: string): Promise<SetupProgress | null> {
  const [org, userCount, adAccounts, seoIntegrations, weeklyReport] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        onboardingDismissed: true,
        logoUrl: true,
        primaryColor: true,
        moduleGoogleAds: true,
        moduleMetaAds: true,
        moduleSEO: true,
        moduleChatbot: true,
        modulePixel: true,
        cursiveIntegration: {
          select: { cursivePixelId: true, lastEventAt: true },
        },
        appfolioIntegration: {
          select: { lastSyncAt: true },
        },
        tenantSiteConfig: {
          select: { chatbotEnabled: true },
        },
      },
    }),
    prisma.user.count({ where: { orgId } }),
    prisma.adAccount.findMany({
      where: { orgId },
      select: { platform: true, lastSyncAt: true },
    }),
    prisma.seoIntegration.findMany({
      where: { orgId },
      select: { provider: true, lastSyncAt: true },
    }),
    prisma.clientReport.findFirst({
      where: { orgId, kind: "weekly" },
      select: { id: true },
    }),
  ]);

  if (!org) return null;

  const ctx: SetupCheckContext = {
    org: {
      logoUrl: org.logoUrl,
      primaryColor: org.primaryColor,
      moduleGoogleAds: org.moduleGoogleAds,
      moduleMetaAds: org.moduleMetaAds,
      moduleSEO: org.moduleSEO,
      moduleChatbot: org.moduleChatbot,
      modulePixel: org.modulePixel,
    },
    cursive: org.cursiveIntegration,
    appfolio: org.appfolioIntegration,
    tenantSiteConfig: org.tenantSiteConfig,
    adAccounts,
    seoIntegrations,
    hasWeeklyReport: weeklyReport != null,
    userCount,
  };

  // First pass: resolve done/locked/pending. Current is assigned after.
  const firstPass: ResolvedSetupStep[] = SETUP_STEPS.map((step) => {
    const done = step.isComplete(ctx);
    if (done) {
      return { ...step, status: "done" as const };
    }
    if (step.requiresModule && !ctx.org[step.requiresModule]) {
      return { ...step, status: "locked" as const };
    }
    return { ...step, status: "pending" as const };
  });

  // Promote the first pending step to current (timeline order).
  let promoted = false;
  const steps: ResolvedSetupStep[] = firstPass.map((s) => {
    if (!promoted && s.status === "pending") {
      promoted = true;
      return { ...s, status: "current" as const };
    }
    return s;
  });

  const completedCount = steps.filter((s) => s.status === "done").length;
  const totalCount = steps.length;

  const foundationSteps = steps.filter((s) => s.phase === "foundation");
  const foundationComplete = foundationSteps.every((s) => s.status === "done");
  const completedFoundation = foundationSteps.filter(
    (s) => s.status === "done"
  ).length;

  // Which phase should the hero label reflect?
  const phase: SetupPhase | "done" = (() => {
    for (const p of PHASE_ORDER) {
      const unresolved = steps.some(
        (s) => s.phase === p && (s.status === "pending" || s.status === "current")
      );
      if (unresolved) return p;
    }
    return "done";
  })();

  const daysToLaunch = Math.max(0, Math.min(14, 14 - 2 * completedFoundation));

  return {
    steps,
    completedCount,
    totalCount,
    foundationComplete,
    phase,
    daysToLaunch,
    org: {
      id: org.id,
      name: org.name,
      onboardingDismissed: org.onboardingDismissed,
    },
  };
}
