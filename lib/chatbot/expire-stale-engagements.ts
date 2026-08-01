import "server-only";

import { prisma } from "@/lib/db";
import { EngagementStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Stale ChatbotEngagement TTL.
//
// A PENDING engagement means "operator pushed a message, widget hasn't
// polled it yet" (see app/api/public/chatbot/inbox/route.ts). If the
// visitor's tab is long closed, that row sits PENDING forever and the
// operator-facing queue (app/admin/chat/page.tsx) reads it as still live.
//
// Flip anything PENDING for >24h to EXPIRED so the UI shows the truth.
// Cross-tenant, no per-row audit trail needed (nothing downstream
// references engagement lifecycle the way marketplace leads do) — single
// bounded updateMany, no row fetch.
//
// ponytail: no per-row cap/backoff — a PENDING backlog here would mean the
// widget poll path is broken org-wide, at which point row count is the
// least of the problems. Add a `take` cap if that stops being true.
// ---------------------------------------------------------------------------

const TTL_MS = 24 * 60 * 60 * 1000;

export async function expireStaleEngagements(
  now: Date = new Date(),
): Promise<{ expiredCount: number }> {
  const cutoff = new Date(now.getTime() - TTL_MS);

  const { count } = await prisma.chatbotEngagement.updateMany({
    where: {
      status: EngagementStatus.PENDING,
      createdAt: { lt: cutoff },
    },
    data: { status: EngagementStatus.EXPIRED },
  });

  return { expiredCount: count };
}
