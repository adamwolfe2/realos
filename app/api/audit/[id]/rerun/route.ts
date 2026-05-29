import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus, Prisma } from "@prisma/client";
import { isValidShareToken } from "@/lib/audit/token";
import { getSiteUrl } from "@/lib/brand";

// POST /api/audit/[id]/rerun
// Public — gated by shareToken match, not Clerk. The viewer's empty-state
// "Re-run scan" button POSTs here when a finished audit has no mentions.
// We flip the row back to QUEUED, clear the prior synthesized payload, and
// fire-and-forget to /api/audit/run/[id] (same pattern as /audit/start).
//
// The `[id]` path segment is the shareToken (the viewer's only handle).
// We accept it in the body too so the rerun handler can be wired from
// either context without leaking IDs into client state.

const BodySchema = z.object({
  shareToken: z.string().trim().min(1).max(128),
});

const RERUN_GRACE_MS = 60_000;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: tokenFromPath } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "shareToken is required" },
      { status: 400 },
    );
  }
  const shareToken = parsed.data.shareToken;

  // Defense in depth: path arg must match body, both must be well-formed.
  if (shareToken !== tokenFromPath) {
    return NextResponse.json(
      { error: "Token mismatch" },
      { status: 400 },
    );
  }
  if (!isValidShareToken(shareToken)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const audit = await prisma.prospectAudit.findUnique({
    where: { shareToken },
    select: { id: true, status: true, createdAt: true },
  });
  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Grace period — block re-runs while the original scan may still be
  // in-flight. Without this, the empty-state button could double-bill the
  // providers for a job that's seconds away from landing.
  if (Date.now() - audit.createdAt.getTime() < RERUN_GRACE_MS) {
    return NextResponse.json(
      { error: "Original scan still running — try again in a moment." },
      { status: 429 },
    );
  }

  // Idempotency: if it's already QUEUED or RUNNING, don't re-trigger.
  if (
    audit.status === ProspectAuditStatus.QUEUED ||
    audit.status === ProspectAuditStatus.RUNNING
  ) {
    return NextResponse.json({ ok: true, status: audit.status });
  }

  // Reset the synthesized payload. We keep brandName + email so the viewer
  // doesn't lose state between runs. The run route will overwrite everything
  // when it finishes.
  await prisma.prospectAudit.update({
    where: { id: audit.id },
    data: {
      status: ProspectAuditStatus.QUEUED,
      errorMessage: null,
      overallScore: null,
      sectionScores: Prisma.JsonNull,
      claudeSummary: null,
      findings: Prisma.JsonNull,
    },
  });

  // Fire-and-forget trigger — same pattern as /api/audit/start.
  const triggerUrl = `${getSiteUrl()}/api/audit/run/${audit.id}`;
  const cronSecret = process.env.CRON_SECRET ?? "";
  fetch(triggerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-trigger": cronSecret,
    },
  }).catch(() => {
    /* swallow — the viewer polls and surfaces stuck-QUEUED to the user */
  });

  return NextResponse.json({ ok: true, status: ProspectAuditStatus.QUEUED });
}
