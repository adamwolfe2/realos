import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { VisitorIdentificationStatus, Prisma } from "@prisma/client";
import { guardIngest } from "@/lib/api-keys/ingest-shared";

// POST /api/ingest/visitor
//
// Generic visitor ingestion keyed on an external identifier. Uses the existing
// `cursiveVisitorId` unique index as the "external identity" key so any
// upstream system (pixel, Zapier, custom analytics) can upsert without
// requiring a separate column.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  externalId: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  pageUrl: z.string().trim().max(2000).optional(),
  referrer: z.string().trim().max(2000).optional(),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  enrichedData: z.record(z.string(), z.unknown()).optional(),
});

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(req: NextRequest) {
  const gate = await guardIngest(req, "ingest:visitor");
  if (!gate.ok) return gate.response;
  const { orgId } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const email = data.email ? data.email.toLowerCase() : null;
  const hashedEmail = email ? sha256(email.trim()) : null;

  const status =
    data.firstName && data.lastName && email
      ? VisitorIdentificationStatus.IDENTIFIED
      : VisitorIdentificationStatus.ANONYMOUS;

  const now = new Date();

  const existing = await prisma.visitor.findFirst({
    where: { orgId, cursiveVisitorId: data.externalId },
    select: { id: true, sessionCount: true },
  });

  let visitorId: string;
  let isNew = false;

  const enrichedData = data.enrichedData
    ? (data.enrichedData as Prisma.InputJsonValue)
    : undefined;

  if (existing) {
    const update: Prisma.VisitorUpdateInput = {
      lastSeenAt: now,
      sessionCount: { increment: 1 },
    };
    if (data.firstName) update.firstName = data.firstName;
    if (data.lastName) update.lastName = data.lastName;
    if (email) update.email = email;
    if (hashedEmail) update.hashedEmail = hashedEmail;
    if (data.phone) update.phone = data.phone;
    if (data.referrer) update.referrer = data.referrer;
    if (data.utmSource) update.utmSource = data.utmSource;
    if (data.utmMedium) update.utmMedium = data.utmMedium;
    if (data.utmCampaign) update.utmCampaign = data.utmCampaign;
    if (enrichedData !== undefined) update.enrichedData = enrichedData;
    // Status only "upgrades" — never demote an IDENTIFIED visitor back to
    // ANONYMOUS because a retry arrived without the name fields populated.
    if (status === VisitorIdentificationStatus.IDENTIFIED) {
      update.status = status;
    }

    const updated = await prisma.visitor.update({
      where: { id: existing.id },
      data: update,
      select: { id: true },
    });
    visitorId = updated.id;
  } else {
    const created = await prisma.visitor.create({
      data: {
        orgId,
        cursiveVisitorId: data.externalId,
        status,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email,
        hashedEmail,
        phone: data.phone ?? null,
        referrer: data.referrer ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        enrichedData,
        pagesViewed: data.pageUrl
          ? ([{ url: data.pageUrl, ts: now.toISOString() }] as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      select: { id: true },
    });
    visitorId = created.id;
    isNew = true;
  }

  return NextResponse.json(
    { ok: true, id: visitorId, created: isNew },
    { status: isNew ? 201 : 200 }
  );
}
