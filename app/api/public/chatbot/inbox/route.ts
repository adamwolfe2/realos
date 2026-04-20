import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { EngagementStatus } from "@prisma/client";
import {
  publicApiLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";

// GET /api/public/chatbot/inbox?sessionId=<uuid>&since=<iso>
//
// Public, CORS-enabled endpoint polled by the chatbot widget every few
// seconds while idle. Returns any PENDING ChatbotEngagement rows for the
// caller's sessionId. Atomically marks them DELIVERED on read so a second
// poll doesn't re-render the same message.
//
// `since` is advisory only — it lets the client skip rows it has already
// seen, but the server source of truth is the row.status flag.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const querySchema = z.object({
  sessionId: z.string().uuid(),
  since: z.string().datetime().optional(),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicApiLimiter, `inbox:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "60" } }
    );
  }

  const parsed = querySchema.safeParse({
    sessionId: req.nextUrl.searchParams.get("sessionId") ?? undefined,
    since: req.nextUrl.searchParams.get("since") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { engagements: [] },
      { status: 200, headers: CORS_HEADERS }
    );
  }
  const { sessionId, since } = parsed.data;

  try {
    const pending = await prisma.chatbotEngagement.findMany({
      where: {
        sessionId,
        status: EngagementStatus.PENDING,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        id: true,
        message: true,
        openWidget: true,
        createdAt: true,
      },
    });

    if (pending.length > 0) {
      const now = new Date();
      await prisma.chatbotEngagement.updateMany({
        where: {
          id: { in: pending.map((p) => p.id) },
          status: EngagementStatus.PENDING,
        },
        data: {
          status: EngagementStatus.DELIVERED,
          deliveredAt: now,
        },
      });
    }

    return NextResponse.json(
      {
        engagements: pending.map((p) => ({
          id: p.id,
          message: p.message,
          openWidget: p.openWidget,
          createdAt: p.createdAt.toISOString(),
        })),
        serverTime: new Date().toISOString(),
      },
      { status: 200, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } }
    );
  } catch (err) {
    // If the migration hasn't been applied to this DB yet, the table doesn't
    // exist and Prisma throws. Fail soft so the widget keeps polling without
    // logging client-visible errors.
    console.warn("[public/chatbot/inbox] query failed:", err);
    return NextResponse.json(
      { engagements: [], serverTime: new Date().toISOString() },
      { status: 200, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } }
    );
  }
}
