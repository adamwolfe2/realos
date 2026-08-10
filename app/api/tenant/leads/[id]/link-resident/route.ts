import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { propertyWhereFragment } from "@/lib/tenancy/property-filter";
import { LEAD_STATUSES_BELOW_SIGNED } from "@/lib/leads/lead-lease-link";
import { ALLOWED_WRITE_ROLES } from "@/lib/auth/write-roles";
import {
  AuditAction,
  LeadMatchDecisionStatus,
  LeadMatchMethod,
  LeadStatus,
  Prisma,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Manual lead ↔ resident link — the operator's "Mark as signed" close-the-
// loop action (2026-08-02 proof chain). POST links a resident to the lead
// and promotes the lead to SIGNED (monotonic — LOST/UNQUALIFIED/SIGNED are
// untouched); DELETE unlinks and deliberately leaves the lead's status
// alone (the status control on the same page is the explicit way to change
// it — one visible mutation surface per field).
//
// Both directions require the lead AND the resident to sit inside the
// caller's org + property scope, and a write-capable role (CLIENT_VIEWER
// is a read-only seat and must not mint a proof claim). A resident already
// linked to a different lead is a 409, never a silent steal — enforced at
// WRITE time by a conditional updateMany, not by the earlier read, so two
// concurrent links for the same resident can't both win.
// ---------------------------------------------------------------------------

const body = z.object({ residentId: z.string().trim().min(1).max(64) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireWritableWorkspace();
    if (!ALLOWED_WRITE_ROLES.has(scope.role)) {
      return NextResponse.json(
        { error: "Your role doesn't allow marking leads as signed." },
        { status: 403 },
      );
    }
    const { id } = await params;

    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({
      // Property-level RBAC: the lead must be visible to this caller.
      where: { id, ...tenantWhere(scope), ...propertyWhereFragment(scope, null) },
      select: { id: true, status: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resident = await prisma.resident.findFirst({
      // Same org AND a property the caller can see — a residentId from
      // another org or an out-of-scope building reads as nonexistent.
      where: {
        id: parsed.data.residentId,
        ...tenantWhere(scope),
        ...propertyWhereFragment(scope, null),
      },
      select: {
        id: true,
        propertyId: true,
        leadId: true,
        firstName: true,
        lastName: true,
        unitNumber: true,
        moveInDate: true,
        currentLease: { select: { startDate: true } },
      },
    });
    if (!resident) {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }

    // Fast-path reads for a friendly response; the AUTHORITATIVE steal
    // check is the conditional write below (this read can go stale).
    if (resident.leadId && resident.leadId !== lead.id) {
      return NextResponse.json(
        { error: "Resident is already linked to a different lead" },
        { status: 409 },
      );
    }
    if (resident.leadId === lead.id) {
      return NextResponse.json({ ok: true, noChange: true });
    }

    // convertedAt anchors to the real signing evidence, not the click:
    // lease start, else move-in, else now. Reports bucket signed leads by
    // convertedAt, so backdating keeps the monthly numbers honest.
    const convertedAt =
      resident.currentLease?.startDate ?? resident.moveInDate ?? new Date();
    const residentName =
      [resident.firstName, resident.lastName].filter(Boolean).join(" ") ||
      resident.id;

    // One interactive transaction: claim the resident CONDITIONALLY (leadId
    // still null), and only if this request won the claim do we promote the
    // lead and write the audit. Without the predicate, two concurrent POSTs
    // from different leads both pass the read-time guard above and both mark
    // their lead SIGNED — leaving one "Signed" with no resident proof.
    const outcome = await prisma.$transaction(async (tx) => {
      const claimed = await tx.resident.updateMany({
        where: { id: resident.id, leadId: null },
        data: { leadId: lead.id, leadLinkManual: true },
      });
      if (claimed.count === 0) return { won: false as const };

      const promoted = await tx.lead.updateMany({
        where: { id: lead.id, status: { in: LEAD_STATUSES_BELOW_SIGNED } },
        data: {
          status: LeadStatus.SIGNED,
          convertedAt,
          lastActivityAt: new Date(),
        },
      });

      // Audit commits WITH the mutation — never a Tier-1 state change that
      // survives while its audit row was lost to a failed insert.
      await tx.auditEvent.create({
        data: auditPayload(scope, {
          action: AuditAction.UPDATE,
          entityType: "Lead",
          entityId: lead.id,
          description: `Linked resident ${residentName}${resident.unitNumber ? ` (unit ${resident.unitNumber})` : ""} to lead${promoted.count > 0 ? `; status ${lead.status} → SIGNED` : ""}`,
          diff: {
            residentId: resident.id,
            promotedToSigned: promoted.count > 0,
            convertedAt: convertedAt.toISOString(),
          } as Prisma.InputJsonValue,
        }),
      });

      await tx.leadMatchDecision.create({
        data: {
          orgId: scope.orgId,
          propertyId: resident.propertyId,
          residentId: resident.id,
          leadId: lead.id,
          status: LeadMatchDecisionStatus.MANUAL_MATCH,
          method: LeadMatchMethod.MANUAL,
          confidence: 100,
          evidence: {
            reasons: ["Operator confirmed the lead and AppFolio resident"],
            convertedAt: convertedAt.toISOString(),
          } satisfies Prisma.InputJsonValue,
          reviewedByUserId: scope.userId,
          reviewedAt: new Date(),
        },
      });

      return { won: true as const, promotedToSigned: promoted.count > 0 };
    });

    if (!outcome.won) {
      // Lost the claim. If the winner was a concurrent request for THIS
      // SAME lead (double-submit, or a client retry after a request that
      // actually committed), the end state is exactly what the caller
      // wanted — report success, not a misleading "different lead" 409.
      const current = await prisma.resident.findFirst({
        where: { id: parsed.data.residentId, ...tenantWhere(scope) },
        select: { leadId: true },
      });
      if (current?.leadId === lead.id) {
        return NextResponse.json({ ok: true, noChange: true });
      }
      return NextResponse.json(
        { error: "Resident is already linked to a different lead" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      promotedToSigned: outcome.promotedToSigned,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireWritableWorkspace();
    if (!ALLOWED_WRITE_ROLES.has(scope.role)) {
      return NextResponse.json(
        { error: "Your role doesn't allow changing lease links." },
        { status: 403 },
      );
    }
    const { id } = await params;

    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const resident = await prisma.resident.findFirst({
      // Must be linked to THIS lead and inside the caller's scope.
      where: {
        id: parsed.data.residentId,
        leadId: id,
        ...tenantWhere(scope),
        ...propertyWhereFragment(scope, null),
      },
      select: {
        id: true,
        propertyId: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!resident) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const residentName =
      [resident.firstName, resident.lastName].filter(Boolean).join(" ") ||
      resident.id;

    await prisma.$transaction(async (tx) => {
      const unlinked = await tx.resident.updateMany({
        // Predicate on the same link we read, so a concurrent re-link
        // isn't clobbered by a stale unlink.
        where: { id: resident.id, leadId: id },
        // leadLinkManual STAYS true: the operator has expressed an opinion
        // about this resident's link, and the AppFolio sync must not
        // auto-re-link them on the next tick (see upsertResident).
        data: { leadId: null, leadLinkManual: true },
      });
      // Only audit a change that actually happened — a concurrent write
      // may have already moved this resident off the lead.
      if (unlinked.count === 0) return;
      await tx.auditEvent.create({
        data: auditPayload(scope, {
          action: AuditAction.UPDATE,
          entityType: "Lead",
          entityId: id,
          description: `Unlinked resident ${residentName} from lead (status left unchanged)`,
          diff: {
            residentId: resident.id,
            unlinked: true,
          } as Prisma.InputJsonValue,
        }),
      });
      await tx.leadMatchDecision.create({
        data: {
          orgId: scope.orgId,
          propertyId: resident.propertyId,
          residentId: resident.id,
          leadId: id,
          status: LeadMatchDecisionStatus.MANUAL_UNLINK,
          method: LeadMatchMethod.MANUAL,
          confidence: 100,
          evidence: {
            reasons: ["Operator rejected the existing lead-resident link"],
          } satisfies Prisma.InputJsonValue,
          reviewedByUserId: scope.userId,
          reviewedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
