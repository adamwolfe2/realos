"use server";

import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";

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
