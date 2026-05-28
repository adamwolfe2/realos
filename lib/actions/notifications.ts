"use server";

import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";

const DAY_MS = 24 * 60 * 60 * 1000;

// Snooze durations exposed in the inbox UI. The server enforces the same
// set so a forged request can't park a row in the database for a year.
const ALLOWED_SNOOZE_DAYS = new Set([1, 7]);

export async function markNotificationRead(notificationId: string): Promise<void> {
  const scope = await requireScope();
  // Verify ownership before updating.
  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      orgId: scope.orgId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(): Promise<void> {
  const scope = await requireScope();
  await prisma.notification.updateMany({
    where: {
      orgId: scope.orgId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

/**
 * Snooze a notification for N days. The row stays in the database but is
 * filtered out of the default inbox view and the unread count until the
 * snooze window expires. Also marks the row read so the bell doesn't keep
 * nagging mid-snooze.
 *
 * Only 1- and 7-day snoozes are exposed in the UI; the server enforces the
 * same set so a forged request can't park a row for a year.
 */
export async function snoozeNotification(
  notificationId: string,
  days: number,
): Promise<void> {
  if (!ALLOWED_SNOOZE_DAYS.has(days)) {
    throw new Error(`Invalid snooze duration: ${days}. Allowed: 1, 7.`);
  }
  const scope = await requireScope();
  const snoozedUntil = new Date(Date.now() + days * DAY_MS);
  await prisma.notification.updateMany({
    where: { id: notificationId, orgId: scope.orgId },
    data: {
      snoozedUntil,
      // Mark read so the bell badge clears while snoozed.
      readAt: new Date(),
    },
  });
}

/**
 * Wake a snoozed notification immediately. Used when an operator opens the
 * "all" view, sees a snoozed row they want back in the queue, and clicks
 * Unsnooze.
 */
export async function unsnoozeNotification(notificationId: string): Promise<void> {
  const scope = await requireScope();
  await prisma.notification.updateMany({
    where: { id: notificationId, orgId: scope.orgId },
    data: { snoozedUntil: null },
  });
}

/**
 * Resolve an actionable notification (integration_error, ai_quota_warning).
 * Distinct from "read" — a row can be read without being resolved. Resolved
 * rows drop out of the default view and the unread count.
 *
 * Also clears any snooze timer and marks the row read so it doesn't keep
 * lighting up the bell after the operator has clearly dealt with it.
 */
export async function resolveNotification(notificationId: string): Promise<void> {
  const scope = await requireScope();
  const now = new Date();
  await prisma.notification.updateMany({
    where: { id: notificationId, orgId: scope.orgId },
    data: {
      resolvedAt: now,
      readAt: now,
      snoozedUntil: null,
    },
  });
}
