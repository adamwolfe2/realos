import { prisma } from "@/lib/db";
import {
  NO_MARKETABLE_PROPERTIES,
} from "@/lib/tenancy/property-filter";
import {
  classifyLeadChannel,
  getSource,
} from "@/lib/attribution/source-taxonomy";
import {
  deriveLeadProof,
  summarizeAttributionFlow,
  sourceProvenance,
  type AttributionFlowSummary,
  type ProofStage,
  type ProofVerification,
} from "@/lib/attribution/proof-model";
import type {
  LeadMatchDecisionStatus,
  LeadMatchMethod,
  LeadSource,
  Prisma,
} from "@prisma/client";

export type AttributionProofRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  propertyName: string | null;
  source: LeadSource;
  sourceId: string;
  sourceLabel: string;
  provenance: string;
  firstTouchAt: Date;
  capturedAt: Date;
  stage: ProofStage;
  verification: ProofVerification;
  outcomeEvidence: string;
  matchMethod: string | null;
  matchConfidence: number | null;
};

export type AttributionReviewRow = {
  decisionId: string;
  residentId: string;
  residentName: string;
  residentEmail: string | null;
  residentPhone: string | null;
  propertyName: string | null;
  candidateLeadId: string | null;
  candidateLeadName: string | null;
  status: LeadMatchDecisionStatus;
  method: string;
  confidence: number;
  createdAt: Date;
};

export type AttributionProof = {
  rows: AttributionProofRow[];
  reviewRows: AttributionReviewRow[];
  flow: AttributionFlowSummary;
  summary: {
    captured: number;
    applied: number;
    verifiedSigned: number;
    reviewNeeded: number;
    imported: number;
  };
  funnel: Array<{
    key: string;
    label: string;
    count: number;
    tracked: boolean;
    provenance: string;
  }>;
};

export function proofPropertyWhere(
  propertyIds: string[],
  includeOrgLevel: boolean,
): Record<string, unknown> {
  if (propertyIds.length === 0) {
    return { propertyId: NO_MARKETABLE_PROPERTIES };
  }
  const property =
    propertyIds.length === 1
      ? { propertyId: propertyIds[0] }
      : { propertyId: { in: [...propertyIds] } };
  return includeOrgLevel ? { OR: [property, { propertyId: null }] } : property;
}

const METHOD_LABEL: Record<LeadMatchMethod, string> = {
  PHONE_EMAIL: "Phone + email",
  NAME_EMAIL: "Name + email",
  NAME_PHONE: "Name + phone",
  EXACT_EMAIL: "Exact email",
  NORMALIZED_EMAIL: "Normalized email",
  EXACT_PHONE: "Exact phone",
  NORMALIZED_PHONE: "Normalized phone",
  FUZZY_COMPOSITE: "Fuzzy composite",
  NAME_ONLY: "Name only",
  MANUAL: "Operator confirmed",
  NONE: "No safe match",
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

function displayName(
  firstName: string | null,
  lastName: string | null,
  fallback: string,
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || fallback;
}

function hasReached(stage: ProofStage, target: ProofStage): boolean {
  return STAGE_RANK[stage] >= STAGE_RANK[target];
}

export async function getAttributionProof(args: {
  orgId: string;
  propertyIds: string[];
  includeOrgLevel: boolean;
  fromDate: Date;
  toDate: Date;
  source?: LeadSource | null;
}): Promise<AttributionProof> {
  const nullablePropertyWhere = proofPropertyWhere(
    args.propertyIds,
    args.includeOrgLevel,
  ) as Prisma.LeadWhereInput;
  const decisionPropertyWhere = proofPropertyWhere(
    args.propertyIds,
    false,
  ) as Prisma.LeadMatchDecisionWhereInput;
  const sessionPropertyWhere = proofPropertyWhere(
    args.propertyIds,
    false,
  ) as Prisma.VisitorSessionWhereInput;
  const leadWhere: Prisma.LeadWhereInput = {
    orgId: args.orgId,
    AND: [nullablePropertyWhere],
    createdAt: { gte: args.fromDate, lte: args.toDate },
    ...(args.source ? { source: args.source } : {}),
  };

  const [leads, decisions, firstTouches] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere,
      orderBy: { createdAt: "desc" },
      take: 5_000,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        source: true,
        status: true,
        externalSystem: true,
        enrichedData: true,
        firstSeenAt: true,
        createdAt: true,
        property: { select: { name: true } },
        visitor: {
          select: {
            status: true,
            sessions: {
              orderBy: { startedAt: "asc" },
              take: 1,
              select: {
                startedAt: true,
                utmSource: true,
                utmMedium: true,
                firstReferrer: true,
              },
            },
          },
        },
        tours: { select: { status: true }, take: 20 },
        applications: {
          select: { status: true, receivedAt: true, appliedAt: true },
          take: 20,
        },
        residents: {
          select: {
            id: true,
            moveInDate: true,
            currentLease: { select: { id: true, startDate: true } },
            leases: { select: { id: true }, take: 1 },
          },
          take: 5,
        },
        matchDecisions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, method: true, confidence: true },
        },
      },
    }),
    prisma.leadMatchDecision.findMany({
      where: {
        orgId: args.orgId,
        AND: [decisionPropertyWhere],
        createdAt: { lte: args.toDate },
        residentId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 1_000,
      select: {
        id: true,
        residentId: true,
        leadId: true,
        status: true,
        method: true,
        confidence: true,
        createdAt: true,
        resident: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            property: { select: { name: true } },
          },
        },
        lead: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.visitorSession.count({
      where: {
        orgId: args.orgId,
        AND: [sessionPropertyWhere],
        startedAt: { gte: args.fromDate, lte: args.toDate },
      },
    }),
  ]);

  const rows: AttributionProofRow[] = leads.map((lead) => {
    const session = lead.visitor?.sessions[0] ?? null;
    const linkedResidents = lead.residents.filter((resident) => resident.id);
    const hasLeaseEvidence = linkedResidents.some(
      (resident) => resident.currentLease !== null || resident.leases.length > 0,
    );
    const latestDecision = lead.matchDecisions[0] ?? null;
    const proof = deriveLeadProof({
      leadStatus: lead.status,
      externalSystem: lead.externalSystem,
      applicationStatuses: lead.applications.map((application) => application.status),
      hasLinkedResident: linkedResidents.length > 0,
      hasLeaseEvidence,
      latestDecisionStatus: latestDecision?.status ?? null,
    });
    const source = lead.externalSystem === "appfolio"
      ? getSource("appfolio")
      : classifyLeadChannel(lead.source, session, null);

    const outcomeEvidence = hasLeaseEvidence
      ? "Matched to AppFolio lease"
      : lead.applications.some((application) => application.status === "APPROVED")
        ? "Approved application from AppFolio"
        : lead.applications.length > 0
          ? "Application from AppFolio"
          : "No PMS outcome yet";

    return {
      id: lead.id,
      name: displayName(lead.firstName, lead.lastName, "Unknown lead"),
      email: lead.email,
      phone: lead.phone,
      propertyName: lead.property?.name ?? null,
      source: lead.source,
      sourceId: source.id,
      sourceLabel: source.label,
      provenance: sourceProvenance(lead.source, lead.externalSystem),
      firstTouchAt: session?.startedAt ?? lead.firstSeenAt,
      capturedAt: lead.createdAt,
      stage: proof.stage,
      verification: proof.verification,
      outcomeEvidence,
      matchMethod: latestDecision ? METHOD_LABEL[latestDecision.method] : null,
      matchConfidence: latestDecision?.confidence ?? null,
    };
  });

  const latestByResident = new Map<string, (typeof decisions)[number]>();
  for (const decision of decisions) {
    if (decision.residentId && !latestByResident.has(decision.residentId)) {
      latestByResident.set(decision.residentId, decision);
    }
  }
  const reviewRows: AttributionReviewRow[] = [...latestByResident.values()]
    .filter(
      (decision) =>
        decision.status === "REVIEW_REQUIRED" || decision.status === "AMBIGUOUS",
    )
    .map((decision) => ({
      decisionId: decision.id,
      residentId: decision.residentId!,
      residentName: displayName(
        decision.resident?.firstName ?? null,
        decision.resident?.lastName ?? null,
        "Unknown AppFolio resident",
      ),
      residentEmail: decision.resident?.email ?? null,
      residentPhone: decision.resident?.phone ?? null,
      propertyName: decision.resident?.property.name ?? null,
      candidateLeadId: decision.leadId,
      candidateLeadName: decision.lead
        ? displayName(
            decision.lead.firstName,
            decision.lead.lastName,
            decision.lead.email ?? "Unknown lead",
          )
        : null,
      status: decision.status,
      method: METHOD_LABEL[decision.method],
      confidence: decision.confidence,
      createdAt: decision.createdAt,
    }));

  const flow = summarizeAttributionFlow(rows);
  const tourEvidence = leads.some((lead) => lead.tours.length > 0);
  const enriched = leads.filter(
    (lead) =>
      lead.enrichedData !== null ||
      (lead.visitor !== null && lead.visitor.status !== "ANONYMOUS"),
  ).length;
  const tourScheduled = leads.filter(
    (lead) =>
      hasReached(deriveLeadProof({
        leadStatus: lead.status,
        externalSystem: lead.externalSystem,
        applicationStatuses: lead.applications.map((application) => application.status),
        hasLinkedResident: lead.residents.length > 0,
        hasLeaseEvidence: lead.residents.some(
          (resident) => resident.currentLease !== null || resident.leases.length > 0,
        ),
        latestDecisionStatus: lead.matchDecisions[0]?.status ?? null,
      }).stage, "Tour scheduled") ||
      lead.tours.some((tour) => tour.status !== "CANCELLED"),
  ).length;
  const toured = leads.filter(
    (lead) =>
      lead.status === "TOURED" ||
      lead.tours.some((tour) => tour.status === "COMPLETED"),
  ).length;
  const contacted = rows.filter((row) => hasReached(row.stage, "Contacted")).length;
  const approved = rows.filter((row) => hasReached(row.stage, "Approved")).length;

  return {
    rows,
    reviewRows,
    flow,
    summary: {
      captured: flow.captured,
      applied: flow.applied,
      verifiedSigned: flow.signed,
      reviewNeeded: reviewRows.length,
      imported: rows.filter((row) => row.verification === "imported").length,
    },
    funnel: [
      {
        key: "first_touch",
        label: "First touch",
        count: firstTouches,
        tracked: true,
        provenance: "Visitor pixel sessions",
      },
      {
        key: "captured",
        label: "Lead captured",
        count: rows.length,
        tracked: true,
        provenance: "LeaseStack lead records",
      },
      {
        key: "enriched",
        label: "Enriched",
        count: enriched,
        tracked: true,
        provenance: "Cursive or captured identity",
      },
      {
        key: "contacted",
        label: "Contacted",
        count: contacted,
        tracked: true,
        provenance: "Lead pipeline status",
      },
      {
        key: "tour_scheduled",
        label: "Tour scheduled",
        count: tourScheduled,
        tracked: tourEvidence,
        provenance: "Tour records",
      },
      {
        key: "toured",
        label: "Toured",
        count: toured,
        tracked: tourEvidence,
        provenance: "Completed tour records",
      },
      {
        key: "applied",
        label: "Applied",
        count: flow.applied,
        tracked: true,
        provenance: "AppFolio applications",
      },
      {
        key: "approved",
        label: "Approved",
        count: approved,
        tracked: true,
        provenance: "AppFolio applications",
      },
      {
        key: "signed",
        label: "Signed",
        count: flow.signed,
        tracked: true,
        provenance: "Matched AppFolio resident and lease",
      },
    ],
  };
}
