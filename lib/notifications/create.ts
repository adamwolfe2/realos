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
