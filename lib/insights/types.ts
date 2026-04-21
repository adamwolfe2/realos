import "server-only";

// ---------------------------------------------------------------------------
// Insights — shared types.
//
// Detectors return an array of `DetectedInsight` which the runner upserts
// into the Insight table keyed on (orgId, dedupeKey). The dedupeKey controls
// re-firing: a weekly traffic drop keyed on ISO-week will only insert once
// per week; a pipeline stall keyed on leadId will flip to "acted" once the
// lead moves status.
// ---------------------------------------------------------------------------

export type InsightSeverity = "info" | "warning" | "critical";

export type InsightCategory =
  | "traffic"
  | "leads"
  | "ads"
  | "seo"
  | "chatbot"
  | "occupancy";

export type InsightKind =
  | "traffic_drop"
  | "traffic_spike"
  | "pipeline_stall"
  | "chatbot_pattern"
  | "cpl_spike"
  | "keyword_drop"
  | "conv_rate_drop"
  | "hot_visitor"
  | "tour_noshow_spike"
  | "chatbot_silence"
  | "leasing_velocity_drop";

export type InsightEntityType =
  | "lead"
  | "property"
  | "campaign"
  | "conversation"
  | "visitor"
  | null;

export interface DetectedInsight {
  kind: InsightKind;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  body: string;
  suggestedAction?: string;
  propertyId?: string | null;
  entityType?: InsightEntityType;
  entityId?: string | null;
  href?: string | null;
  /**
   * Stable key that prevents re-firing the same insight on subsequent cron
   * runs. Examples:
   *   "traffic_drop:prop_abc:week:2026-16"
   *   "pipeline_stall:lead_xyz"
   *   "cpl_spike:account_meta_123:week:2026-16"
   */
  dedupeKey: string;
  /**
   * Context used by the UI renderer. Keep numeric where possible so the
   * frontend can format currency, percent, counts without parsing strings.
   */
  context?: Record<string, unknown>;
}

export interface DetectorResult {
  detector: string;
  insights: DetectedInsight[];
  skipped?: string;
  error?: string;
}

export interface Detector {
  name: string;
  run(orgId: string): Promise<DetectedInsight[]>;
}
