import "server-only";
import { prisma } from "@/lib/db";
import type { Detector, DetectedInsight } from "../types";

const MIN_SESSION_SECONDS = 90;
const MIN_PAGE_VIEWS = 3;
const LOOKBACK_HOURS = 2;

/**
 * Hot visitor detector.
 *
 * Fires when an identified visitor (has an email) has shown high-intent
 * behavior in the last 2 hours but hasn't yet become a lead: long session,
 * multiple page views, viewing floor plans or the apply page. This is the
 * kind of signal Norman's team has never had — "someone is about to convert,
 * reach out now."
 */
export const hotVisitorDetector: Detector = {
  name: "hot-visitor",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

    const sessions = await prisma.visitorSession.findMany({
      where: {
        orgId,
        lastEventAt: { gte: since },
        totalTimeSeconds: { gte: MIN_SESSION_SECONDS },
        pageviewCount: { gte: MIN_PAGE_VIEWS },
        visitorId: { not: null },
      },
      select: {
        id: true,
        visitorId: true,
        pageviewCount: true,
        totalTimeSeconds: true,
        startedAt: true,
        lastEventAt: true,
        firstUrl: true,
        visitor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            leads: { select: { id: true }, take: 1 },
          },
        },
      },
      orderBy: { lastEventAt: "desc" },
      take: 15,
    });

    return sessions
      .filter((s) => s.visitor?.email && (s.visitor.leads?.length ?? 0) === 0)
      .map((s) => {
        const v = s.visitor!;
        const minutes = Math.round(s.totalTimeSeconds / 60);
        const name =
          [v.firstName, v.lastName].filter(Boolean).join(" ").trim() ||
          v.email ||
          "An unnamed visitor";

        return {
          kind: "hot_visitor",
          category: "leads",
          severity: "warning" as const,
          title: `${name} is browsing right now and has not submitted yet`,
          body: `${s.pageviewCount} pages in ${minutes} minutes. Landing page: ${s.firstUrl ?? "unknown"}.`,
          suggestedAction:
            "Open the visitor detail page and trigger a chatbot engage or call them. Hottest window is the next 5 minutes.",
          entityType: "visitor",
          entityId: v.id,
          href: `/portal/visitors/${v.id}`,
          dedupeKey: `hot_visitor:${v.id}:${s.id}`,
          context: {
            visitorId: v.id,
            sessionId: s.id,
            email: v.email,
            pageViews: s.pageviewCount,
            totalTimeSeconds: s.totalTimeSeconds,
            landingPageUrl: s.firstUrl,
            lastEventAt: s.lastEventAt.toISOString(),
          },
        };
      });
  },
};
