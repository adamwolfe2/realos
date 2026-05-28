import "server-only";
import { prisma } from "@/lib/db";
import type { Lead, Tour, ChatbotConversation } from "@prisma/client";

// ---------------------------------------------------------------------------
// Notification creation helpers.
// All functions are fire-and-forget safe: callers should use void + .catch().
// ---------------------------------------------------------------------------

function leadName(lead: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const full = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  return full || lead.email || "Unknown";
}

export async function notifyLeadCreated(
  lead: Pick<Lead, "id" | "orgId" | "firstName" | "lastName" | "email" | "source">
): Promise<void> {
  const name = leadName(lead);
  await prisma.notification.create({
    data: {
      orgId: lead.orgId,
      kind: "lead_created",
      title: `New lead: ${name}`,
      body: `Source: ${lead.source.toLowerCase().replace(/_/g, " ")}`,
      entityType: "Lead",
      entityId: lead.id,
      href: `/portal/leads/${lead.id}`,
    },
  });
}

export async function notifyTourScheduled(
  tour: Pick<Tour, "id" | "leadId" | "scheduledAt" | "tourType"> & {
    orgId: string;
    leadName?: string;
  }
): Promise<void> {
  const when = tour.scheduledAt
    ? tour.scheduledAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "time TBD";
  const type = tour.tourType ?? "in-person";
  await prisma.notification.create({
    data: {
      orgId: tour.orgId,
      kind: "tour_scheduled",
      title: `Tour scheduled${tour.leadName ? ` for ${tour.leadName}` : ""}`,
      body: `${type} on ${when}`,
      entityType: "Tour",
      entityId: tour.id,
      href: `/portal/leads/${tour.leadId}`,
    },
  });
}

export async function notifyChatbotLeadCaptured(
  conversation: Pick<
    ChatbotConversation,
    "id" | "orgId" | "capturedName" | "capturedEmail" | "leadId"
  >
): Promise<void> {
  const name = conversation.capturedName || conversation.capturedEmail || "visitor";
  await prisma.notification.create({
    data: {
      orgId: conversation.orgId,
      kind: "chatbot_lead",
      title: `Chatbot captured lead: ${name}`,
      body: conversation.capturedEmail ?? null,
      entityType: "ChatbotConversation",
      entityId: conversation.id,
      href: conversation.leadId
        ? `/portal/leads/${conversation.leadId}`
        : `/portal/conversations`,
    },
  });
}

export async function notifyIntegrationError(
  orgId: string,
  integration: string,
  error: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      orgId,
      kind: "integration_error",
      title: `Integration error: ${integration}`,
      body: error.slice(0, 300),
      entityType: "Integration",
      href: `/portal/settings`,
    },
  });
}

/**
 * Fire a notification when a new actionable insight is detected.
 *
 * Severity policy:
 *   - critical → always notify (bell badge + insight kind=critical_insight)
 *   - warning  → notify (bell badge + kind=warning_insight)
 *   - info     → no notification (would be too noisy; lives in /portal/insights only)
 *
 * Dedupe-safe via entityId match so the detector can re-run without
 * stacking notifications. Backwards-compat alias `notifyCriticalInsight`
 * preserved for any caller still expecting the old name.
 */
export async function notifyNewInsight(insight: {
  id: string;
  orgId: string;
  severity: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<void> {
  if (insight.severity !== "critical" && insight.severity !== "warning") {
    return;
  }
  const kind =
    insight.severity === "critical" ? "critical_insight" : "warning_insight";

  const existing = await prisma.notification.findFirst({
    where: {
      orgId: insight.orgId,
      kind,
      entityId: insight.id,
    },
    select: { id: true },
  });
  if (existing) return;

  await prisma.notification.create({
    data: {
      orgId: insight.orgId,
      kind,
      title: insight.title,
      body: insight.body.slice(0, 300),
      entityType: "Insight",
      entityId: insight.id,
      href: insight.href ?? "/portal/insights",
    },
  });
}

/** @deprecated — use notifyNewInsight which handles both critical + warning. */
export async function notifyCriticalInsight(insight: {
  id: string;
  orgId: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<void> {
  await notifyNewInsight({ ...insight, severity: "critical" });
}

/**
 * Admin-facing notification when an operator submits a new content
 * draft that needs review. Routes to a synthetic LeaseStack agency org
 * (orgType=AGENCY) so the bell badge surfaces on /admin. Returns silently
 * if no agency org exists in this environment.
 */
export async function notifyDraftSubmitted(input: {
  draftId: string;
  format: string;
  brief: string;
  clientOrgName: string;
  propertyName: string | null;
}): Promise<void> {
  const agency = await prisma.organization
    .findFirst({
      where: { orgType: "AGENCY" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => null);
  if (!agency) return;
  const fmt = input.format.replace(/_/g, " ").toLowerCase();
  const propTag = input.propertyName ? ` (${input.propertyName})` : "";
  await prisma.notification.create({
    data: {
      orgId: agency.id,
      kind: "draft_submitted",
      title: `New draft from ${input.clientOrgName}${propTag}`,
      body: `${fmt}: ${input.brief.slice(0, 180)}`,
      entityType: "ContentDraft",
      entityId: input.draftId,
      href: `/admin/content-drafts/${input.draftId}`,
    },
  });
}

/**
 * Operator-facing notification when their content draft has been
 * reviewed by LeaseStack (approved, request_changes, or rejected).
 * Surfaces in the portal bell so operators don't have to refresh
 * /portal/seo/drafts to see status changes.
 */
export async function notifyDraftReviewed(input: {
  orgId: string;
  draftId: string;
  status: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "SHIPPED";
  format: string;
  propertyName: string | null;
}): Promise<void> {
  const formatLabel = input.format.replace(/_/g, " ").toLowerCase();
  const propertyTag = input.propertyName ? ` for ${input.propertyName}` : "";
  const title =
    input.status === "APPROVED"
      ? `Draft approved: ${formatLabel}${propertyTag}`
      : input.status === "SHIPPED"
        ? `Draft shipped: ${formatLabel}${propertyTag}`
        : input.status === "CHANGES_REQUESTED"
          ? `Changes requested on ${formatLabel}${propertyTag}`
          : `Draft rejected: ${formatLabel}${propertyTag}`;
  const body =
    input.status === "CHANGES_REQUESTED"
      ? "Open the draft to see notes and re-submit."
      : input.status === "REJECTED"
        ? "Open the draft to see why."
        : "Open the draft to view the final content.";
  await prisma.notification.create({
    data: {
      orgId: input.orgId,
      kind: "draft_reviewed",
      title,
      body,
      entityType: "ContentDraft",
      entityId: input.draftId,
      href: `/portal/seo/agent/drafts/${input.draftId}`,
    },
  });
}

/**
 * Fire a notification when an org crosses ~80% of its hourly AI call quota.
 *
 * Why a separate notification (vs the hard 429 block at 100%): operators
 * burn through Claude budget in batches (regenerating a draft, iterating on
 * a report) and the 429 lands mid-flow with no warning. Surfacing the 80%
 * crossing in the inbox lets them pace themselves before they get blocked.
 *
 * Dedupe: one notification per (org, current hour). The caller fires this
 * on every AI call; this helper short-circuits if a warning already exists
 * within the last hour so the inbox doesn't fill up on a busy operator.
 *
 * Kind = "ai_quota_warning" — requires explicit Resolve (it's an action
 * row, not a passive read).
 */
export async function notifyAiQuotaWarning(input: {
  orgId: string;
  used: number;
  limit: number;
  resetAt: Date;
}): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await prisma.notification.findFirst({
    where: {
      orgId: input.orgId,
      kind: "ai_quota_warning",
      createdAt: { gte: oneHourAgo },
    },
    select: { id: true },
  });
  if (existing) return;

  const pct = Math.round((input.used / input.limit) * 100);
  const resetIn = Math.max(
    1,
    Math.round((input.resetAt.getTime() - Date.now()) / 60_000),
  );
  await prisma.notification.create({
    data: {
      orgId: input.orgId,
      kind: "ai_quota_warning",
      title: `AI usage at ${pct}% of daily limit`,
      body: `${input.used}/${input.limit} AI calls used today. Limit resets in ~${resetIn}m. Slow down or upgrade if you need more headroom.`,
      entityType: "AiQuota",
      href: `/portal/billing`,
    },
  });
}

/**
 * Fire a pacing notification — leasing velocity, ad spend, CPL, audience
 * exhaustion, etc. — surfaced from the insight detector. These are time-
 * sensitive operations rows (the leasing window is sprinting; ignored
 * pacing drift becomes a missed quarter), distinct from generic insight
 * notifications.
 *
 * Dedupe: piggybacks on insight.id so re-running the detector for the
 * same week doesn't stack rows.
 */
export async function notifyPacingAlert(input: {
  insightId: string;
  orgId: string;
  severity: "warning" | "critical";
  title: string;
  body: string;
  href?: string | null;
}): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: {
      orgId: input.orgId,
      kind: "pacing_alert",
      entityId: input.insightId,
    },
    select: { id: true },
  });
  if (existing) return;

  await prisma.notification.create({
    data: {
      orgId: input.orgId,
      kind: "pacing_alert",
      title: input.title,
      body: input.body.slice(0, 300),
      entityType: "Insight",
      entityId: input.insightId,
      href: input.href ?? "/portal/insights",
    },
  });
}

/**
 * Fire a notification when a draft weekly report is generated on Monday and
 * is waiting for operator review. Keeps the white-glove loop intact.
 */
export async function notifyReportDraftReady(
  orgId: string,
  reportId: string,
  kind: "weekly" | "monthly",
): Promise<void> {
  const label = kind === "weekly" ? "Weekly" : "Monthly";
  await prisma.notification.create({
    data: {
      orgId,
      kind: "report_draft_ready",
      title: `${label} report draft is ready to review`,
      body: `Add your headline and personal note, then send or share the link with your client.`,
      entityType: "ClientReport",
      entityId: reportId,
      href: `/portal/reports/${reportId}`,
    },
  });
}
