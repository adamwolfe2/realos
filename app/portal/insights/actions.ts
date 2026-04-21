"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";

async function getOwnedInsight(id: string) {
  const scope = await requireScope();
  const insight = await prisma.insight.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true },
  });
  if (!insight) throw new Error("Insight not found");
  return { scope, insight };
}

export async function acknowledgeInsight(id: string) {
  try {
    const { scope } = await getOwnedInsight(id);
    await prisma.insight.update({
      where: { id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: scope.userId,
      },
    });
    revalidatePath("/portal/insights");
    revalidatePath("/portal/briefing");
    revalidatePath("/portal");
    return { success: true as const };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function dismissInsight(id: string) {
  try {
    await getOwnedInsight(id);
    await prisma.insight.update({
      where: { id },
      data: { status: "dismissed", dismissedAt: new Date() },
    });
    revalidatePath("/portal/insights");
    revalidatePath("/portal/briefing");
    revalidatePath("/portal");
    return { success: true as const };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function snoozeInsight(id: string, hours: number) {
  try {
    await getOwnedInsight(id);
    await prisma.insight.update({
      where: { id },
      data: {
        snoozeUntil: new Date(Date.now() + hours * 60 * 60 * 1000),
      },
    });
    revalidatePath("/portal/insights");
    revalidatePath("/portal/briefing");
    revalidatePath("/portal");
    return { success: true as const };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function markActed(id: string) {
  try {
    await getOwnedInsight(id);
    await prisma.insight.update({
      where: { id },
      data: { status: "acted" },
    });
    revalidatePath("/portal/insights");
    revalidatePath("/portal/briefing");
    revalidatePath("/portal");
    return { success: true as const };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function markBriefingViewed() {
  try {
    const scope = await requireScope();
    await prisma.user.update({
      where: { id: scope.userId },
      data: { lastBriefingViewedAt: new Date() },
    });
    revalidatePath("/portal/briefing");
    return { success: true as const };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
