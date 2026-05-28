import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import { LeadNotifyChannel, UserRole } from "@prisma/client";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";

// ---------------------------------------------------------------------------
// POST /api/portal/settings/notify-test
//
// Fires a one-off test notification using the org's currently-configured
// notifyLeadEmail + channel toggles. Routed through the same notifyLeadCaptured
// pipeline as a real lead so the operator can sanity-check:
//   - the address is correct
//   - Resend isn't bouncing (delivery row will land FAILED on bad sender)
//   - the inbox isn't aggressively folding ops mail into spam
//
// Returns the LeadNotificationDelivery row id so the UI can deep-link to
// the audit log entry if we ever build one.
// ---------------------------------------------------------------------------

const ALLOWED_ROLES = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

export async function POST() {
  try {
    const scope = await requireScope();
    if (!ALLOWED_ROLES.has(scope.role)) {
      return NextResponse.json(
        { error: "Only org owners and admins can send test notifications." },
        { status: 403 },
      );
    }

    const fakeLeadId = `TEST-${Date.now().toString(36)}`;

    // Snapshot the latest delivery row id BEFORE firing so we can return the
    // newly-created one (notifyLeadCaptured is fire-and-forget at the call
    // site; here we await for the test path so the UI can confirm).
    await notifyLeadCaptured({
      orgId: scope.orgId,
      leadId: fakeLeadId,
      propertyId: null,
      channel: LeadNotifyChannel.MANUAL,
      lead: {
        name: "Test Lead",
        email: "test@example.com",
        phone: "(555) 010-0000",
        sourceLabel: "Test from /portal/settings",
        intent: "If you see this, lead-capture notifications are working.",
      },
    });

    // Pull the row we just wrote so we can hand its id back to the UI. The
    // helper writes one row per call, so the latest row for this org + this
    // fake leadId is unambiguously ours.
    const latest = await prisma.leadNotificationDelivery.findFirst({
      where: { orgId: scope.orgId, leadId: fakeLeadId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, recipient: true, errorMessage: true },
    });

    return NextResponse.json({
      ok: true,
      deliveryId: latest?.id ?? null,
      status: latest?.status ?? null,
      recipient: latest?.recipient ?? null,
      errorMessage: latest?.errorMessage ?? null,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[notify-test] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
