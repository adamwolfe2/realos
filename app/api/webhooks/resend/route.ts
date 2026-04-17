import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { AuditAction, Prisma } from "@prisma/client";

// POST /api/webhooks/resend
// Ingests Resend webhook events (email.sent, email.delivered, email.opened,
// email.clicked, email.bounced, email.complained). Updates the Lead's
// lastActivityAt on engagement events and logs an audit row for traceability.
//
// Verify signature with Svix-style headers when a secret is configured.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
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
    const lead = await prisma.lead.findFirst({
      where: { email: to },
      select: { id: true, orgId: true },
    });
    if (!lead) continue;

    if (
      type === "email.opened" ||
      type === "email.clicked" ||
      type === "email.delivered"
    ) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastActivityAt: new Date() },
      });
    }
    if (type === "email.bounced" || type === "email.complained") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          unsubscribedFromEmails: true,
          unsubscribedAt: new Date(),
        },
      });
    }

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

function verifySignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // DECISION: when no secret is configured we accept everything. Flip this
    // to "reject" once we set the secret in env and the Resend dashboard.
    return true;
  }
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(toSign)
    .digest("base64");

  // svix-signature header format: "v1,<base64>"
  const parts = svixSignature.split(" ").map((p) => p.trim().split(","));
  for (const pair of parts) {
    if (pair.length < 2) continue;
    const provided = pair[1];
    try {
      if (
        crypto.timingSafeEqual(
          Buffer.from(provided),
          Buffer.from(expected)
        )
      ) {
        return true;
      }
    } catch {
      // ignore length mismatch
    }
  }
  return false;
}
