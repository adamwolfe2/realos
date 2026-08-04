export type ProductCapabilityKey =
  | "connected-data-foundation"
  | "lead-to-lease-attribution"
  | "ai-leasing-chatbot"
  | "conversion-offers"
  | "reputation-rescue"
  | "search-opportunity-engine"
  | "monday-action-brief"
  | "website-build";

export type CapabilitySubject =
  | Readonly<{ scope: "organization"; orgId: string }>
  | Readonly<{ scope: "property"; orgId: string; propertyId: string }>;

export type CapabilitySignalKey =
  | "scope.verified"
  | "integration.any_source"
  | "integration.lead_source"
  | "integration.downstream_outcome"
  | "integration.verified_domain"
  | "integration.appfolio_availability"
  | "integration.appfolio_leases"
  | "integration.cursive_pixel"
  | "integration.ga4"
  | "integration.gsc"
  | "integration.reputation_source"
  | "integration.search_intelligence"
  | "integration.chatbot_origin"
  | "setup.chatbot_configured"
  | "setup.notification_recipient"
  | "setup.offer_published"
  | "setup.reputation_identity"
  | "setup.brief_recipient"
  | "setup.website_scope_approved"
  | "outcome.fresh_scoped_record"
  | "outcome.attributed_journey"
  | "outcome.coverage_measured"
  | "outcome.chatbot_conversation"
  | "outcome.chatbot_lead"
  | "outcome.chatbot_truth_test"
  | "outcome.notification_delivered"
  | "outcome.offer_impression"
  | "outcome.offer_conversion"
  | "outcome.reputation_baseline"
  | "outcome.reputation_action"
  | "outcome.search_baseline"
  | "outcome.search_opportunity"
  | "outcome.brief_generated"
  | "outcome.brief_delivered"
  | "outcome.brief_opened"
  | "outcome.website_live"
  | "outcome.measurement_verified";

export type CapabilitySignalState =
  | "disconnected"
  | "verifying"
  | "backfilling"
  | "ready"
  | "partial"
  | "stale"
  | "error"
  | "unsupported";

export type CapabilityEvidenceKind =
  | "configuration"
  | "connection"
  | "sync"
  | "record"
  | "delivery"
  | "outcome"
  | "health";

// Evidence deliberately has no free-form payload, identifier, error, or
// contact field. User-facing proof summaries come only from version-controlled
// contracts, so a loader cannot accidentally leak PII or provider errors.
export type CapabilityEvidence = Readonly<{
  kind: CapabilityEvidenceKind;
  observedAt: Date;
}>;

export type CapabilitySignal = Readonly<{
  key: CapabilitySignalKey;
  subject: CapabilitySubject;
  state: CapabilitySignalState;
  evidence: readonly CapabilityEvidence[];
}>;

export type CapabilityRequirement = Readonly<{
  key: string;
  label: string;
  kind: "integration" | "setup" | "activation";
  satisfaction: "all" | "any";
  impact: "required" | "degraded";
  signalKeys: readonly CapabilitySignalKey[];
  acceptedScope: "organization" | "exact_property" | "either";
  requiredEvidence: readonly CapabilityEvidenceKind[];
  maxEvidenceAgeMs?: number;
  proofSummary: string;
  blockerSummary: string;
  actionHref: string;
}>;

export type CapabilityContract = Readonly<{
  productKey: ProductCapabilityKey;
  subjectScopes: readonly CapabilitySubject["scope"][];
  requirements: readonly CapabilityRequirement[];
}>;

export type CapabilityCheckStatus =
  | "passed"
  | "disconnected"
  | "verifying"
  | "backfilling"
  | "partial"
  | "needs_attention";

export type CapabilityCheck = Readonly<{
  requirementKey: string;
  label: string;
  kind: CapabilityRequirement["kind"];
  impact: CapabilityRequirement["impact"];
  status: CapabilityCheckStatus;
  matchedSignalKeys: readonly CapabilitySignalKey[];
}>;

export type CapabilityBlockerCode =
  | "disconnected"
  | "missing_evidence"
  | "verifying"
  | "backfilling"
  | "stale"
  | "source_error"
  | "partial"
  | "unsupported";

export type CapabilityBlocker = Readonly<{
  code: CapabilityBlockerCode;
  requirementKey: string;
  severity: "blocking" | "degraded";
  summary: string;
  actionHref: string;
}>;

export type VerifiedCapabilityEvidence = Readonly<{
  requirementKey: string;
  summary: string;
  kinds: readonly CapabilityEvidenceKind[];
  observedAt: Date;
}>;

export type CapabilityProfileStatus =
  | "disconnected"
  | "verifying"
  | "backfilling"
  | "ready"
  | "partially_ready"
  | "needs_attention";

export type CapabilityProfile = Readonly<{
  productKey: ProductCapabilityKey;
  subject: CapabilitySubject;
  status: CapabilityProfileStatus;
  checks: readonly CapabilityCheck[];
  evidence: readonly VerifiedCapabilityEvidence[];
  blockers: readonly CapabilityBlocker[];
  evaluatedAt: Date;
}>;
