"use server";

import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { generateReportSnapshot, type ReportKind, type ReportSnapshot } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";
import { sendReportEmail } from "@/lib/email/send-report";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Server actions for ClientReport. Every call is tenant-scoped via
// requireScope(); operator review is mandatory so nothing here ever auto-sends.
// ---------------------------------------------------------------------------

export async function createReport(
  kind: ReportKind,
  options: { propertyId?: string | null } = {},
): Promise<{ id: string }> {
  if (kind !== "weekly" && kind !== "monthly" && kind !== "custom") {
    throw new Error("Invalid report kind");
  }
  const scope = await requireScope();

  // If a property was requested, validate it belongs to this org. Pre-empts
  // any chance of an off-tenant id slipping through and gives us a stable
  // propertyId to persist on the ClientReport row.
  let validPropertyId: string | null = null;
  if (options.propertyId) {
    const owned = await prisma.property.findFirst({
      where: { id: options.propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!owned) throw new Error("Property not found in this workspace");
    validPropertyId = owned.id;
  }

  const snapshot = await generateReportSnapshot(scope.orgId, kind, {
    propertyId: validPropertyId,
  });

  const report = await prisma.clientReport.create({
    data: {
      orgId: scope.orgId,
      propertyId: validPropertyId,
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

// ---------------------------------------------------------------------------
// Email delivery. Operator-initiated only (no cron auto-send). Uses Resend
// when configured; otherwise returns the rendered preview so the operator
// can still copy the HTML into their own client before the sending domain
// lands.
// ---------------------------------------------------------------------------

export async function sendReportToRecipients(
  id: string,
  input: {
    to: string[];
    recipientName?: string | null;
    replyTo?: string | null;
  },
): Promise<{
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: "no_resend_key";
  previewSubject?: string;
}> {
  const scope = await requireScope();

  const recipients = (input.to ?? [])
    .map((r) => r.trim())
    .filter((r) => r.includes("@"));
  if (recipients.length === 0) {
    throw new Error("At least one valid recipient email is required");
  }

  const report = await prisma.clientReport.findFirst({
    where: { id, orgId: scope.orgId },
    select: {
      id: true,
      kind: true,
      snapshot: true,
      shareToken: true,
      headline: true,
      notes: true,
      status: true,
      org: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
  });
  if (!report) throw new Error("Report not found");

  const sender = await prisma.user.findUnique({
    where: { id: scope.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  const senderName =
    [sender?.firstName, sender?.lastName].filter(Boolean).join(" ").trim() || undefined;

  const result = await sendReportEmail({
    to: recipients,
    orgName: report.org.name,
    orgLogoUrl: report.org.logoUrl,
    snapshot: report.snapshot as unknown as ReportSnapshot,
    shareToken: report.shareToken,
    headline: report.headline,
    notes: report.notes,
    recipientName: input.recipientName ?? null,
    senderName,
    replyTo: input.replyTo ?? sender?.email ?? null,
  });

  if (result.ok) {
    // First successful send flips draft to shared so the public link works.
    if (report.status === "draft") {
      await prisma.clientReport.update({
        where: { id },
        data: { status: "shared", sharedAt: new Date() },
      });
    }
    revalidatePath(`/portal/reports/${id}`);
  }

  return {
    ok: result.ok,
    messageId: result.messageId,
    error: result.error,
    skipped: result.skipped,
    previewSubject: result.previewSubject,
  };
}
