"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BugReportStatus,
  AuditAction,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditPayload, requireAgency } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Bug report admin actions.
//
// Every mutation:
//   1. requireAgency() — non-agency callers are refused, even if
//      they manage to surface the admin page somehow
//   2. Loads the report by id (no tenant join — bug reports are
//      agency-wide, not org-scoped)
//   3. Writes an AuditEvent under the agency's actualOrgId so the
//      admin audit log shows who approved/rejected what
//   4. Appends a timeline entry so the per-report history is
//      append-only and complete
//   5. revalidatePath so the list + detail pages refresh
// ---------------------------------------------------------------------------

export type ActionResult = { ok: true } | { ok: false; error: string };

type TimelineEntry = {
  at: string;
  by: string | null;
  byEmail: string;
  kind: "status" | "note";
  from?: BugReportStatus;
  to?: BugReportStatus;
  text?: string;
};

function appendTimeline(
  existing: Prisma.JsonValue,
  entry: TimelineEntry,
): TimelineEntry[] {
  const prior = Array.isArray(existing) ? (existing as TimelineEntry[]) : [];
  return [...prior, entry];
}

const noteSchema = z.object({
  text: z.string().trim().min(1, "Note required").max(2000),
});

export async function setBugReportStatus(
  id: string,
  next: BugReportStatus,
  resolutionNote?: string,
): Promise<ActionResult> {
  const scope = await requireAgency();

  // Read status + title + current timeline in ONE round-trip. Pre-fix
  // we did two findUnique calls (one for status/title, then a second
  // inside appendTimeline → getTimeline) plus an update — three
  // round-trips and a real read-modify-write race where concurrent
  // triage clicks could lose timeline entries. Folding the read into
  // a single transaction with the update closes the race and saves
  // a hop.
  const trimmedNote = resolutionNote?.trim() ?? null;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.bugReport.findUnique({
      where: { id },
      select: { status: true, title: true, timeline: true },
    });
    if (!current) return { found: false as const };
    if (current.status === next) {
      return { found: true as const, alreadyAt: next, title: current.title };
    }
    const nextTimeline = appendTimeline(current.timeline, {
      at: now.toISOString(),
      by: scope.userId,
      byEmail: scope.email,
      kind: "status",
      from: current.status,
      to: next,
      text: trimmedNote ?? undefined,
    });
    await tx.bugReport.update({
      where: { id },
      data: {
        status: next,
        resolutionNote: trimmedNote || undefined,
        approvedAt: next === BugReportStatus.APPROVED ? now : undefined,
        approvedBy:
          next === BugReportStatus.APPROVED ? scope.userId : undefined,
        rejectedAt: next === BugReportStatus.REJECTED ? now : undefined,
        rejectedBy:
          next === BugReportStatus.REJECTED ? scope.userId : undefined,
        timeline: nextTimeline as Prisma.InputJsonValue,
      },
    });
    return { found: true as const, fromStatus: current.status, title: current.title };
  });

  if (!result.found) return { ok: false, error: "Bug report not found." };
  if ("alreadyAt" in result) {
    return { ok: false, error: `Report is already ${result.alreadyAt}.` };
  }
  const current = { status: result.fromStatus, title: result.title };

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "BugReport",
      entityId: id,
      description: `Bug report "${current.title.slice(0, 60)}" moved ${current.status} → ${next}`,
    }),
  });

  revalidatePath("/admin/bug-reports");
  revalidatePath(`/admin/bug-reports/${id}`);
  return { ok: true };
}

export async function addBugReportNote(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const scope = await requireAgency();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Note required.",
    };
  }

  const now = new Date();

  // Same race-closing pattern as setBugReportStatus — read the existing
  // timeline and write the appended entry inside one transaction so
  // concurrent note + status edits don't clobber each other's entries.
  const found = await prisma.$transaction(async (tx) => {
    const current = await tx.bugReport.findUnique({
      where: { id },
      select: { timeline: true },
    });
    if (!current) return false;
    const nextTimeline = appendTimeline(current.timeline, {
      at: now.toISOString(),
      by: scope.userId,
      byEmail: scope.email,
      kind: "note",
      text: parsed.data.text,
    });
    await tx.bugReport.update({
      where: { id },
      data: { timeline: nextTimeline as Prisma.InputJsonValue },
    });
    return true;
  });

  if (!found) return { ok: false, error: "Bug report not found." };

  revalidatePath(`/admin/bug-reports/${id}`);
  return { ok: true };
}

/** Thin wrappers so a server-component <form action={...}> can call us. */
export async function approveBugReport(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  await setBugReportStatus(id, BugReportStatus.APPROVED, note);
}
export async function rejectBugReport(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  await setBugReportStatus(id, BugReportStatus.REJECTED, note);
}
export async function markBugReportInProgress(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await setBugReportStatus(id, BugReportStatus.IN_PROGRESS);
}
export async function markBugReportFixed(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await setBugReportStatus(id, BugReportStatus.FIXED);
}
export async function reopenBugReport(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await setBugReportStatus(id, BugReportStatus.IN_PROGRESS);
}
