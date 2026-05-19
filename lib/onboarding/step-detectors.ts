// ---------------------------------------------------------------------------
// Onboarding step detectors.
//
// For each step key, a small detector function asks: "Has the operator
// actually reached the state this step gates on?" Detectors are stateless
// — they translate platform state into a boolean + optional provenance
// blob. `syncOnboardingProgress(orgId)` runs every detector in parallel
// and writes one Prisma update per stale step.
//
// CHEAP TO RUN. The whole sync is ~10 short count() queries, all indexed.
// Safe to call on /portal page-load behind a `currentPhase != COMPLETED`
// gate. We DO NOT run sync inside hot loops (lead-ingest, webhook fan-out).
// For mutating hooks (createProperty, integration-complete, lead-ingest),
// callers fire-and-forget via `syncOnboardingProgressInBackground` which
// swallows errors and never blocks the user's action.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import {
  OnboardingPhase,
  OnboardingStepKey,
  OnboardingStepStatus,
  ReputationScanStatus,
} from "@prisma/client";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  getOrInitOnboardingProgress,
  markStepCompleted,
  type ProgressSnapshot,
} from "@/lib/onboarding/state-machine";

export type DetectorResult = {
  done: boolean;
  metadata?: Record<string, unknown>;
};

// Each detector receives the orgId and returns whether the gate is met.
// Keep these queries narrow (count/exists, never findMany).
type Detector = (orgId: string) => Promise<DetectorResult>;

// ---------------------------------------------------------------------------
// FOUNDATION
// ---------------------------------------------------------------------------

const detectAddProperty: Detector = async (orgId) => {
  const count = await prisma.property.count({
    where: marketablePropertyWhere(orgId),
  });
  return { done: count > 0, metadata: { propertyCount: count } };
};

const detectConnectDataSource: Detector = async (orgId) => {
  const [appfolio, seo, cursive, ad] = await Promise.all([
    prisma.appFolioIntegration.count({ where: { orgId } }),
    prisma.seoIntegration.count({ where: { orgId } }),
    prisma.cursiveIntegration.count({ where: { orgId } }),
    prisma.adAccount.count({ where: { orgId } }),
  ]);
  const total = appfolio + seo + cursive + ad;
  return {
    done: total > 0,
    metadata: { appfolio, seo, cursive, ad },
  };
};

const detectConfirmContactPrefs: Detector = async (orgId) => {
  // Minimum bar: primaryContactEmail set on the Organization. This is what
  // every cron job + transactional sender reads from, so a missing value
  // = no reachable contact. UI prompt asks the operator to also confirm
  // notification preferences, but the schema currently has no per-channel
  // toggle to inspect (Notification table doesn't carry per-org prefs).
  // When that's added, expand this detector to require both.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { primaryContactEmail: true },
  });
  const hasEmail = !!org?.primaryContactEmail?.trim();
  return { done: hasEmail, metadata: { hasContactEmail: hasEmail } };
};

const detectApproveChatbotPersona: Detector = async (orgId) => {
  const cfg = await prisma.tenantSiteConfig.findUnique({
    where: { orgId },
    select: { chatbotEnabled: true, chatbotPersonaName: true },
  });
  const done = !!cfg && cfg.chatbotEnabled && !!cfg.chatbotPersonaName?.trim();
  return { done, metadata: { chatbotEnabled: cfg?.chatbotEnabled ?? false } };
};

const detectInstallPixel: Detector = async (orgId) => {
  // "Pixel installed" = at least one CursiveIntegration row for this org
  // has received a real visitor event (lastEventAt populated). The schema
  // tracks visitor pings as `lastEventAt`, not `lastWebhookAt` — same
  // signal, different column name.
  const row = await prisma.cursiveIntegration.findFirst({
    where: { orgId, lastEventAt: { not: null } },
    select: { id: true, lastEventAt: true, installedOnDomain: true },
    orderBy: { lastEventAt: "desc" },
  });
  return {
    done: !!row,
    metadata: row
      ? {
          installedOnDomain: row.installedOnDomain,
          lastEventAt: row.lastEventAt?.toISOString() ?? null,
        }
      : {},
  };
};

// ---------------------------------------------------------------------------
// GROWTH
// ---------------------------------------------------------------------------

const detectVerifyLeadCapture: Detector = async (orgId) => {
  const count = await prisma.lead.count({ where: { orgId } });
  return { done: count > 0, metadata: { leadCount: count } };
};

const detectConnectAds: Detector = async (orgId) => {
  const count = await prisma.adAccount.count({ where: { orgId } });
  return { done: count > 0, metadata: { adAccountCount: count } };
};

const detectReviewFirstReport: Detector = async (orgId) => {
  // "Reviewed" = at least one ClientReport row exists AND was opened
  // (lastViewedAt set). Pre-fix the spec said `viewedAt` — the actual
  // column on ClientReport is `lastViewedAt`, populated by the public
  // share-page view tracker.
  const row = await prisma.clientReport.findFirst({
    where: { orgId, lastViewedAt: { not: null } },
    select: { id: true, lastViewedAt: true },
    orderBy: { lastViewedAt: "desc" },
  });
  return {
    done: !!row,
    metadata: row
      ? { lastViewedAt: row.lastViewedAt?.toISOString() ?? null }
      : {},
  };
};

const detectSetReputationQueries: Detector = async (orgId) => {
  // No standalone ReputationQuery model — operators trigger scans against
  // their properties from /portal/reputation. The "queries set up" signal
  // is "the operator has run at least one successful (or partial) scan."
  // That implies they configured property → reputation monitoring.
  const count = await prisma.reputationScan.count({
    where: {
      orgId,
      status: {
        in: [ReputationScanStatus.SUCCEEDED, ReputationScanStatus.PARTIAL],
      },
    },
  });
  return { done: count > 0, metadata: { successfulScanCount: count } };
};

// ---------------------------------------------------------------------------
// POLISH
// ---------------------------------------------------------------------------

const detectCustomDomain: Detector = async (orgId) => {
  const count = await prisma.domainBinding.count({ where: { orgId } });
  return { done: count > 0, metadata: { domainCount: count } };
};

const detectWhiteLabel: Detector = async (orgId) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { whiteLabel: true },
  });
  return { done: !!org?.whiteLabel, metadata: {} };
};

const detectGenerateNeighborhoodPage: Detector = async (orgId) => {
  const count = await prisma.neighborhoodPage.count({ where: { orgId } });
  return { done: count > 0, metadata: { neighborhoodPageCount: count } };
};

const detectCustomReportPrefs: Detector = async (orgId) => {
  // No per-org "report frequency" column yet. Use a proxy: the operator
  // has generated at least one custom (kind="custom") ClientReport — that
  // demonstrates they've moved past defaults. When OrganizationReportPrefs
  // ships, point this detector at it.
  const count = await prisma.clientReport.count({
    where: { orgId, kind: "custom" },
  });
  return { done: count > 0, metadata: { customReportCount: count } };
};

const detectInviteTeammate: Detector = async (orgId) => {
  const count = await prisma.user.count({ where: { orgId } });
  return { done: count >= 2, metadata: { userCount: count } };
};

// ---------------------------------------------------------------------------
// Detector registry.
// ---------------------------------------------------------------------------
const DETECTORS: Record<OnboardingStepKey, Detector> = {
  [OnboardingStepKey.ADD_PROPERTY]: detectAddProperty,
  [OnboardingStepKey.CONNECT_DATA_SOURCE]: detectConnectDataSource,
  [OnboardingStepKey.CONFIRM_CONTACT_PREFS]: detectConfirmContactPrefs,
  [OnboardingStepKey.APPROVE_CHATBOT_PERSONA]: detectApproveChatbotPersona,
  [OnboardingStepKey.INSTALL_PIXEL]: detectInstallPixel,
  [OnboardingStepKey.VERIFY_LEAD_CAPTURE]: detectVerifyLeadCapture,
  [OnboardingStepKey.CONNECT_ADS]: detectConnectAds,
  [OnboardingStepKey.REVIEW_FIRST_REPORT]: detectReviewFirstReport,
  [OnboardingStepKey.SET_REPUTATION_QUERIES]: detectSetReputationQueries,
  [OnboardingStepKey.CUSTOM_DOMAIN]: detectCustomDomain,
  [OnboardingStepKey.WHITE_LABEL]: detectWhiteLabel,
  [OnboardingStepKey.GENERATE_NEIGHBORHOOD_PAGE]:
    detectGenerateNeighborhoodPage,
  [OnboardingStepKey.CUSTOM_REPORT_PREFS]: detectCustomReportPrefs,
  [OnboardingStepKey.INVITE_TEAMMATE]: detectInviteTeammate,
};

// ---------------------------------------------------------------------------
// syncOnboardingProgress — runs every detector and flips any step whose
// detector returns done=true and is currently PENDING/IN_PROGRESS.
// Steps already COMPLETED or SKIPPED are left alone (we never un-skip).
//
// Cheap and idempotent — safe to call from page-load. We deliberately do
// NOT mutate state when a detector flips false (the operator might delete
// a property, but they've still "done the step"). Onboarding is a forward
// ratchet.
//
// Returns the final ProgressSnapshot after any phase advancement.
// ---------------------------------------------------------------------------
export async function syncOnboardingProgress(
  orgId: string,
): Promise<ProgressSnapshot> {
  const snapshot = await getOrInitOnboardingProgress(orgId);

  // Short-circuit: nothing to do once the operator has finished POLISH.
  if (snapshot.currentPhase === OnboardingPhase.COMPLETED) {
    return snapshot;
  }

  const stale = snapshot.steps.filter(
    (s) =>
      s.status === OnboardingStepStatus.PENDING ||
      s.status === OnboardingStepStatus.IN_PROGRESS,
  );
  if (stale.length === 0) return snapshot;

  // Fan-out detectors in parallel — every call is one indexed count().
  const results = await Promise.all(
    stale.map(async (step) => {
      try {
        const out = await DETECTORS[step.stepKey](orgId);
        return { step, out };
      } catch (err) {
        console.warn(
          `[onboarding] detector failed for ${step.stepKey} on org ${orgId}:`,
          err,
        );
        return { step, out: { done: false } as DetectorResult };
      }
    }),
  );

  let latest = snapshot;
  for (const { step, out } of results) {
    if (!out.done) continue;
    latest = await markStepCompleted(orgId, step.stepKey, out.metadata);
  }
  return latest;
}

// Fire-and-forget wrapper. Use from mutating hooks (property create,
// integration complete, lead create) where we must not block the user.
// All errors are swallowed and logged.
export function syncOnboardingProgressInBackground(orgId: string): void {
  syncOnboardingProgress(orgId).catch((err) => {
    console.warn(
      `[onboarding] background sync failed for org ${orgId}:`,
      err,
    );
  });
}
