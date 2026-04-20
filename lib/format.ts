// ---------------------------------------------------------------------------
// Display helpers. Everywhere the UI needs to render a Prisma enum (LeadStatus,
// TenantStatus, AuditAction, etc.), it goes through here instead of dumping
// the raw SCREAMING_SNAKE_CASE string into the DOM. This file is the single
// source of truth for how an internal value becomes a human phrase.
//
// Keep this boring. No React, no Tailwind, no I/O.
// ---------------------------------------------------------------------------

import type {
  AuditAction,
  LeadSource,
  LeadStatus,
  OrgType,
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
  SubscriptionTier,
  TenantStatus,
  TourStatus,
  ApplicationStatus,
  VisitorIdentificationStatus,
  ChatbotConversationStatus,
  CreativeRequestStatus,
} from "@prisma/client";

const TENANT_STATUS: Record<TenantStatus, string> = {
  INTAKE_RECEIVED: "Intake received",
  CONSULTATION_BOOKED: "Consultation booked",
  PROPOSAL_SENT: "Proposal sent",
  CONTRACT_SIGNED: "Contract signed",
  BUILD_IN_PROGRESS: "Building",
  QA: "In QA",
  LAUNCHED: "Launched",
  ACTIVE: "Active",
  AT_RISK: "At risk",
  CHURNED: "Churned",
  PAUSED: "Paused",
};

const LEAD_STATUS: Record<LeadStatus, string> = {
  NEW: "New",
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

const LEAD_SOURCE: Record<LeadSource, string> = {
  CHATBOT: "Chatbot",
  FORM: "Website form",
  PIXEL_OUTREACH: "Pixel outreach",
  REFERRAL: "Referral",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  ORGANIC: "Organic search",
  DIRECT: "Direct",
  EMAIL_CAMPAIGN: "Email campaign",
  COLD_EMAIL: "Cold email",
  MANUAL: "Manual entry",
  OTHER: "Other",
};

const TOUR_STATUS: Record<TourStatus, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};

const APPLICATION_STATUS: Record<ApplicationStatus, string> = {
  STARTED: "Started",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
};

const VISITOR_STATUS: Record<VisitorIdentificationStatus, string> = {
  ANONYMOUS: "Anonymous",
  IDENTIFIED: "Identified",
  ENRICHED: "Enriched",
  MATCHED_TO_LEAD: "Matched to lead",
};

const CHATBOT_STATUS: Record<ChatbotConversationStatus, string> = {
  ACTIVE: "Active",
  ABANDONED: "Abandoned",
  LEAD_CAPTURED: "Lead captured",
  HANDED_OFF: "Handed off",
  CLOSED: "Closed",
};

const CREATIVE_STATUS: Record<CreativeRequestStatus, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  IN_PROGRESS: "In progress",
  REVISION_REQUESTED: "Revision requested",
  DELIVERED: "Delivered",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const PROPERTY_TYPE: Record<PropertyType, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  MIXED: "Mixed-use",
};

const RESIDENTIAL_SUBTYPE: Record<ResidentialSubtype, string> = {
  STUDENT_HOUSING: "Student housing",
  MULTIFAMILY: "Multifamily",
  SENIOR_LIVING: "Senior living",
  SINGLE_FAMILY_RENTAL: "Single-family rental",
  CO_LIVING: "Co-living",
  SHORT_TERM_RENTAL: "Short-term rental",
};

const COMMERCIAL_SUBTYPE: Record<CommercialSubtype, string> = {
  OFFICE: "Office",
  RETAIL: "Retail",
  INDUSTRIAL: "Industrial",
  MIXED_USE: "Mixed-use",
  FLEX_SPACE: "Flex space",
  MEDICAL_OFFICE: "Medical office",
};

const SUBSCRIPTION_TIER: Record<SubscriptionTier, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  SCALE: "Scale",
  CUSTOM: "Custom",
};

const ORG_TYPE: Record<OrgType, string> = {
  AGENCY: "Agency",
  CLIENT: "Client",
};

const AUDIT_ACTION: Record<AuditAction, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  IMPERSONATE_START: "Started impersonation",
  IMPERSONATE_END: "Ended impersonation",
  LOGIN: "Signed in",
  EXPORT: "Exported data",
  SETTING_CHANGE: "Changed a setting",
};

// Fallback: "BUILD_IN_PROGRESS" → "Build in progress"
function sentenceFromEnum(raw: string): string {
  const lower = raw.toLowerCase().replaceAll("_", " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function humanTenantStatus(s: TenantStatus | string): string {
  return (TENANT_STATUS as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanLeadStatus(s: LeadStatus | string): string {
  return (LEAD_STATUS as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanLeadSource(s: LeadSource | string): string {
  return (LEAD_SOURCE as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanTourStatus(s: TourStatus | string): string {
  return (TOUR_STATUS as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanApplicationStatus(s: ApplicationStatus | string): string {
  return (APPLICATION_STATUS as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanVisitorStatus(s: VisitorIdentificationStatus | string): string {
  return (VISITOR_STATUS as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanChatbotStatus(s: ChatbotConversationStatus | string): string {
  return (CHATBOT_STATUS as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanCreativeStatus(s: CreativeRequestStatus | string): string {
  return (CREATIVE_STATUS as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanPropertyType(s: PropertyType | string): string {
  return (PROPERTY_TYPE as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanResidentialSubtype(s: ResidentialSubtype | string): string {
  return (RESIDENTIAL_SUBTYPE as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanCommercialSubtype(s: CommercialSubtype | string): string {
  return (COMMERCIAL_SUBTYPE as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanSubscriptionTier(s: SubscriptionTier | string): string {
  return (SUBSCRIPTION_TIER as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanOrgType(s: OrgType | string): string {
  return (ORG_TYPE as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}
export function humanAuditAction(s: AuditAction | string): string {
  return (AUDIT_ACTION as Record<string, string>)[s] ?? sentenceFromEnum(String(s));
}

// Semantic tone buckets for status badges. Callers map these to a UI color.
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

export function tenantStatusTone(s: TenantStatus | string): BadgeTone {
  switch (s) {
    case "ACTIVE":
    case "LAUNCHED":
      return "success";
    case "BUILD_IN_PROGRESS":
    case "QA":
    case "CONTRACT_SIGNED":
    case "PROPOSAL_SENT":
    case "CONSULTATION_BOOKED":
      return "info";
    case "INTAKE_RECEIVED":
      return "neutral";
    case "AT_RISK":
      return "warning";
    case "CHURNED":
    case "PAUSED":
      return "muted";
    default:
      return "neutral";
  }
}

export function leadStatusTone(s: LeadStatus | string): BadgeTone {
  switch (s) {
    case "SIGNED":
    case "APPROVED":
      return "success";
    case "TOUR_SCHEDULED":
    case "TOURED":
    case "APPLIED":
    case "APPLICATION_SENT":
      return "info";
    case "NEW":
    case "CONTACTED":
      return "neutral";
    case "LOST":
    case "UNQUALIFIED":
      return "muted";
    default:
      return "neutral";
  }
}
