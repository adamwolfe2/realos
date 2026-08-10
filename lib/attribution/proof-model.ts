import type {
  ApplicationStatus,
  LeadMatchDecisionStatus,
  LeadSource,
  LeadStatus,
} from "@prisma/client";

export type ProofStage =
  | "New lead"
  | "Contacted"
  | "Tour scheduled"
  | "Toured"
  | "Application sent"
  | "Applied"
  | "Approved"
  | "Signed"
  | "Lost"
  | "Unqualified";

export type ProofVerification =
  | "verified"
  | "review_needed"
  | "leasestack_only"
  | "imported";

export type AttributionFlowSummary = {
  captured: number;
  chatbot: number;
  forms: number;
  visitorPixel: number;
  other: number;
  applied: number;
  signed: number;
};

type AttributionFlowRow = {
  source: LeadSource;
  stage: ProofStage;
  verification: ProofVerification;
};

type LeadProofInput = {
  leadStatus: LeadStatus;
  externalSystem: string | null;
  applicationStatuses: ApplicationStatus[];
  hasLinkedResident: boolean;
  hasLeaseEvidence: boolean;
  latestDecisionStatus: LeadMatchDecisionStatus | null;
};

const STATUS_STAGE: Record<LeadStatus, ProofStage> = {
  NEW: "New lead",
  CONTACTED: "Contacted",
  TOUR_SCHEDULED: "Tour scheduled",
  TOURED: "Toured",
  APPLICATION_SENT: "Application sent",
  APPLIED: "Applied",
  APPROVED: "Approved",
  SIGNED: "Signed",
  LOST: "Lost",
  UNQUALIFIED: "Unqualified",
};

const STAGE_RANK: Record<ProofStage, number> = {
  "New lead": 0,
  Contacted: 1,
  "Tour scheduled": 2,
  Toured: 3,
  "Application sent": 4,
  Applied: 5,
  Approved: 6,
  Signed: 7,
  Lost: -1,
  Unqualified: -1,
};

function laterStage(left: ProofStage, right: ProofStage): ProofStage {
  return STAGE_RANK[right] > STAGE_RANK[left] ? right : left;
}

export function summarizeAttributionFlow(
  rows: AttributionFlowRow[],
): AttributionFlowSummary {
  const leaseStackRows = rows.filter((row) => row.verification !== "imported");
  const sourceCount = (source: LeadSource) =>
    leaseStackRows.filter((row) => row.source === source).length;
  const chatbot = sourceCount("CHATBOT");
  const forms = sourceCount("FORM");
  const visitorPixel = sourceCount("PIXEL_OUTREACH");

  return {
    captured: leaseStackRows.length,
    chatbot,
    forms,
    visitorPixel,
    other: leaseStackRows.length - chatbot - forms - visitorPixel,
    applied: leaseStackRows.filter(
      (row) => STAGE_RANK[row.stage] >= STAGE_RANK.Applied,
    ).length,
    signed: leaseStackRows.filter(
      (row) => row.stage === "Signed" && row.verification === "verified",
    ).length,
  };
}

export function deriveLeadProof(input: LeadProofInput): {
  stage: ProofStage;
  verification: ProofVerification;
} {
  let stage = STATUS_STAGE[input.leadStatus];

  if (
    input.applicationStatuses.some((status) => status === "APPROVED")
  ) {
    stage = laterStage(stage, "Approved");
  } else if (
    input.applicationStatuses.some((status) =>
      ["SUBMITTED", "UNDER_REVIEW", "DENIED"].includes(status),
    )
  ) {
    stage = laterStage(stage, "Applied");
  }

  if (input.hasLinkedResident && input.hasLeaseEvidence) {
    stage = laterStage(stage, "Signed");
  }

  const verification: ProofVerification = input.externalSystem
    ? "imported"
    : input.hasLinkedResident && input.hasLeaseEvidence
      ? "verified"
      : input.latestDecisionStatus === "REVIEW_REQUIRED" ||
          input.latestDecisionStatus === "AMBIGUOUS"
        ? "review_needed"
        : "leasestack_only";

  return { stage, verification };
}

const SOURCE_PROVENANCE: Record<LeadSource, string> = {
  CHATBOT: "Captured by LeaseStack chatbot",
  FORM: "Captured by LeaseStack form or popup",
  PIXEL_OUTREACH: "Resolved by Cursive visitor pixel",
  REFERRAL: "Captured by LeaseStack referral link",
  GOOGLE_ADS: "Attributed from Google Ads",
  META_ADS: "Attributed from Meta Ads",
  ORGANIC: "Attributed from organic search",
  DIRECT: "Captured from direct traffic",
  EMAIL_CAMPAIGN: "Attributed from email campaign",
  COLD_EMAIL: "Attributed from outbound email",
  MANUAL: "Entered manually by an operator",
  OTHER: "Source not provided",
};

export function sourceProvenance(
  source: LeadSource,
  externalSystem: string | null,
): string {
  if (externalSystem?.toLowerCase() === "appfolio") {
    return "Imported from AppFolio";
  }
  return SOURCE_PROVENANCE[source];
}
