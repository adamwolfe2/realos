// Shared types for the property Overview tab and its extracted
// sub-components. Split out of overview.tsx (mechanical refactor) so the
// activity-timeline pieces and the main tab can both reference the same
// row shapes without a circular import.

export type ActivityKind =
  | "lead"
  | "tour"
  | "lease"
  | "review"
  | "renewal"
  | "notice";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  summary: string;
  occurredAt: Date;
};

export type ActivityLeadRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  source: string;
  createdAt: Date;
};
export type ActivityTourRow = {
  id: string;
  status: string;
  scheduledAt: Date | null;
  createdAt: Date;
  lead: { firstName: string | null; lastName: string | null } | null;
};
export type ActivityLeaseRow = {
  id: string;
  status: string;
  monthlyRentCents: number | null;
  endDate: Date | null;
  renewalSentAt: Date | null;
  noticeGivenAt: Date | null;
  updatedAt: Date;
};
export type ActivityMentionRow = {
  id: string;
  source: string;
  rating: number | null;
  authorName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
};

export type InsightSeverity = "alert" | "warn" | "info" | "ok";
export type AiInsightShape = {
  severity: InsightSeverity;
  headline: string;
  body: string;
};

export type IntegrationHealth = "healthy" | "degraded" | "off";
