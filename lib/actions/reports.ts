"use server";

import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { generateReportSnapshot, type ReportKind } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Server actions for ClientReport. Every call is tenant-scoped via
// requireScope(); operator review is mandatory so nothing here ever auto-sends.
// ---------------------------------------------------------------------------

export async function createReport(kind: ReportKind): Promise<{ id: string }> {
  if (kind !== "weekly" && kind !== "monthly" && kind !== "custom") {
    throw new Error("Invalid report kind");
  }
  const scope = await requireScope();
  const snapshot = await generateReportSnapshot(scope.orgId, kind);

  const report = await prisma.clientReport.create({
    data: {
      orgId: scope.orgId,
      kind,
      periodStart: new Date(snapshot.periodStart),
      periodEnd: new Date(snapshot.periodEnd),
      snapshot: snapshot as object as never,
      shareToken: generateShareToken(),
      status: "draft",
      generatedBy: scope.userId,
    },
    select: { id: true },
  });

  revalidatePath("/portal/reports");
  return { id: report.id };
}

export async function updateReport(
  id: string,
  input: { headline?: string | null; notes?: string | null; status?: "draft" | "shared" | "archived" },
): Promise<void> {
  const scope = await requireScope();

  // Load for ownership + transition logic.
  const existing = await prisma.clientReport.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true, status: true, shareToken: true, sharedAt: true },
  });
  if (!existing) throw new Error("Report not found");

  const data: Record<string, unknown> = {};
  if (input.headline !== undefined) data.headline = input.headline;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "shared" && !existing.sharedAt) {
      data.sharedAt = new Date();
    }
  }

  await prisma.clientReport.update({
    where: { id },
    data,
  });

  revalidatePath("/portal/reports");
  revalidatePath(`/portal/reports/${id}`);
}

export async function archiveReport(id: string): Promise<void> {
  const scope = await requireScope();
  await prisma.clientReport.updateMany({
    where: { id, orgId: scope.orgId },
    data: { status: "archived" },
  });
  revalidatePath("/portal/reports");
}
