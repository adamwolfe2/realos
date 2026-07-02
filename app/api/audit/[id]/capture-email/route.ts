import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  auditEmailCaptureLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";

// POST /api/audit/[id]/capture-email
// Public. Captures a prospect email against an existing ProspectAudit
// and extends the row's expiry from 90d → 365d so we keep it warm for
// remarketing. No auth — the route is rate-limited at the page level
// through the audit-start limiter; once an audit exists the throttle
// is already paid.

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

const EXTENDED_EXPIRY_DAYS = 365;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  // Rate-limit per IP — fail-closed. No captureToken column exists yet
  // (migration deferred); this + idempotency (409 below) are the lightweight
  // mitigations against drive-by email injection on known audit UUIDs.
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(
    auditEmailCaptureLimiter,
    `audit-email:${ip}`,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  }

  const audit = await prisma.prospectAudit.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Idempotency: reject changes once an email has been captured.
  if (audit.email !== null) {
    return NextResponse.json(
      { error: "Email already captured for this audit" },
      { status: 409 },
    );
  }

  await prisma.prospectAudit.update({
    where: { id },
    data: {
      email: parsed.data.email,
      emailCapturedAt: new Date(),
      expiresAt: new Date(
        Date.now() + EXTENDED_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ),
    },
  });
  return NextResponse.json({ ok: true });
}
