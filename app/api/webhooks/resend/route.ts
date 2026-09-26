import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/email/resend-webhook-signature";
import { prisma } from "@/lib/db";
import { AuditAction, Prisma } from "@prisma/client";
import { webhookLimiter, checkRateLimit, getIp, rateLimited } from "@/lib/rate-limit";

// POST /api/webhooks/resend
// Ingests Resend webhook events (email.sent, email.delivered, email.opened,
// email.clicked, email.bounced, email.complained). Updates the Lead's
// lastActivityAt on engagement events and logs an audit row for traceability.
//
// Verify signature with Svix-style headers when a secret is configured.
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(webhookLimiter, `wh-resend:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  const rawBody = await req.text();
  // Cap at 3 MB to prevent memory/CPU DoS via forged oversize POSTs.
  if (Buffer.byteLength(rawBody, "utf8") > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }
  if (!verifySignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ResendEvent;
  try {
    payload = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = payload.type ?? "";
  const email = payload.data?.to ?? payload.data?.to_email ?? null;
  const recipients = normalizeRecipients(email);

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, ignored: "no recipient" });
  }

  for (const to of recipients) {
    // findMany, not findFirst. The same email address can be a Lead at
    // more than one tenant (e.g. a renter shopping multiple LeaseStack
    // properties) — picking only the first match silently dropped the
    // bounce/open update for every other tenant. Worse, the choice was
    // ordering-dependent: which tenant got the engagement update was a
    // coin flip per webhook, breaking attribution analytics in both
    // directions. Updating every matching lead is the multi-tenant
    // correct behavior.
    const leads = await prisma.lead.findMany({
      where: { email: to },
      select: { id: true, orgId: true },
    });
    if (leads.length === 0) continue;

    const leadIds = leads.map((l) => l.id);

    if (
      type === "email.opened" ||
      type === "email.clicked" ||
      type === "email.delivered"
    ) {
      await prisma.lead.updateMany({
        where: { id: { in: leadIds } },
        data: { lastActivityAt: new Date() },
      });
    }
    if (type === "email.bounced" || type === "email.complained") {
      await prisma.lead.updateMany({
        where: { id: { in: leadIds } },
        data: {
          unsubscribedFromEmails: true,
          unsubscribedAt: new Date(),
        },
      });
    }

    // Per-tenant audit rows so each org sees the engagement event for
    // their own lead — not a single audit attributed to whichever org
    // happened to match first.
    for (const lead of leads) {
      await prisma.auditEvent.create({
        data: {
          orgId: lead.orgId,
          action: AuditAction.UPDATE,
          entityType: "EmailEvent",
          entityId: lead.id,
          description: `${type}, ${to}`,
          diff: payload as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

type ResendEvent = {
  type?: string;
  data?: {
    to?: string | string[];
    to_email?: string;
    email_id?: string;
    [k: string]: unknown;
  };
};

function normalizeRecipients(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string" && v.includes("@"));
  if (typeof raw === "string" && raw.includes("@")) return [raw];
  return [];
}

