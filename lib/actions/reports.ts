"use server";

import { prisma } from "@/lib/db";
import { requireWritableWorkspace } from "@/lib/tenancy/scope";
import { generateReportSnapshot, type ReportKind, type ReportSnapshot } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";
import { canAccessReport, REPORT_PORTFOLIO_ACCESS_ERROR } from "@/lib/reports/access";
import { checkAiBillingGate, aiBillingDeniedResponseBody } from "@/lib/billing/gate";
import { aiCallLimiter, notifyLimiter, checkRateLimit } from "@/lib/rate-limit";
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
  const scope = await requireWritableWorkspace();

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
    // Property-restricted users may only snapshot properties they're granted
    // (mirrors /portal/properties/[id]/snapshot). Same error as the org miss
    // so the response doesn't reveal which check fired.
    if (!canAccessReport(scope, owned.id)) {
      throw new Error("Property not found in this workspace");
    }
    validPropertyId = owned.id;
  } else if (!canAccessReport(scope, null)) {
    // No propertyId means an org-wide snapshot rolling up every property.
    // Mirrors POST /api/portal/reports, which 403s restricted users for the
    // same reason: the snapshot would include buildings they can't see and
    // the shareToken makes it world-readable.
    throw new Error(REPORT_PORTFOLIO_ACCESS_ERROR);
  }

  // Snapshot generation invokes the LLM polish helper (Claude Haiku), so
  // this server action enforces the same two spend controls as the API
  // route: the billing gate (delinquent orgs must not burn Anthropic
  // budget) and the per-user hourly AI rate limit.
  const billingGate = await checkAiBillingGate(scope.orgId, {
    isImpersonating: scope.isImpersonating,
  });
  if (!billingGate.allowed) {
    throw new Error(aiBillingDeniedResponseBody(billingGate).error);
  }
  const rl = await checkRateLimit(aiCallLimiter, `ai-call:${scope.userId}`);
  if (!rl.allowed) {
    throw new Error("AI rate limit hit (10 calls per hour). Try again soon.");
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
  const scope = await requireWritableWorkspace();

  // Load for ownership + transition logic.
  const existing = await prisma.clientReport.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true, status: true, shareToken: true, sharedAt: true, propertyId: true },
  });
  if (!existing) throw new Error("Report not found");
  // Same error as the org miss so the response doesn't leak which check
  // fired. Blocks a restricted user from mutating (esp. sharing) an
  // org-wide or out-of-scope report.
  if (!canAccessReport(scope, existing.propertyId)) {
    throw new Error("Report not found");
  }

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
  const scope = await requireWritableWorkspace();
  const existing = await prisma.clientReport.findFirst({
    where: { id, orgId: scope.orgId },
    select: { propertyId: true },
  });
  if (!existing) return; // preserve prior updateMany no-op on missing id
  if (!canAccessReport(scope, existing.propertyId)) {
    throw new Error("Report not found");
  }
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
  const scope = await requireWritableWorkspace();

  // Per-user send throttle: an authenticated account must not be usable
  // as a bulk relay on the org's sending domain.
  const sendRl = await checkRateLimit(notifyLimiter, `report-send:${scope.userId}`);
  if (!sendRl.allowed) {
    throw new Error("Sending too quickly. Try again in a minute.");
  }

  const recipients = (input.to ?? [])
    .map((r) => r.trim())
    .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
    .slice(0, 10); // cap batch size; report emails are 1:1 client sends
  if (recipients.length === 0) {
    throw new Error("At least one valid recipient email is required");
  }

  const report = await prisma.clientReport.findFirst({
    where: { id, orgId: scope.orgId },
    select: {
      id: true,
      kind: true,
      propertyId: true,
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
  // Restricted users must not email an org-wide or out-of-scope snapshot
  // (emailing also flips draft → shared, activating the public link).
  if (!canAccessReport(scope, report.propertyId)) {
    throw new Error("Report not found");
  }

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
