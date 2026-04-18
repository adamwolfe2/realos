// ---------------------------------------------------------------------------
// Timeline event builder for the Lead detail page.
//
// Merges signals from four sources into one chronological feed:
//   - Lead creation           (Lead.firstSeenAt)
//   - Pixel page views        (Visitor.pagesViewed JSON array)
//   - Chatbot conversations   (ChatbotConversation rows)
//   - Tours                   (Tour rows)
//   - Applications            (Application rows)
//
// Dense page views inside the same browsing session (<15 min apart) are
// rolled up into a single "Browsed N pages" event so the feed stays readable.
// ---------------------------------------------------------------------------
import type {
  Application,
  ChatbotConversation,
  Lead,
  Tour,
  Visitor,
} from "@prisma/client";

export type TimelineEvent =
  | {
      kind: "lead_created";
      id: string;
      ts: Date;
      source: string;
      sourceDetail: string | null;
    }
  | {
      kind: "pixel_first_seen";
      id: string;
      ts: Date;
      referrer: string | null;
      utmSource: string | null;
    }
  | {
      kind: "pixel_page_view";
      id: string;
      ts: Date;
      url: string;
      path: string;
      eventType: string | null;
    }
  | {
      kind: "pixel_page_rollup";
      id: string;
      ts: Date;          // timestamp of the LAST view in the rollup
      startedAt: Date;   // timestamp of the FIRST view in the rollup
      pages: Array<{ url: string; path: string; ts: Date }>;
    }
  | {
      kind: "chatbot_conversation";
      id: string;
      ts: Date;
      conversation: ChatbotConversationLite;
    }
  | {
      kind: "tour";
      id: string;
      ts: Date;
      tour: Tour;
    }
  | {
      kind: "application";
      id: string;
      ts: Date;
      application: Application;
    }
  | {
      kind: "status_signed";
      id: string;
      ts: Date;
    };

export type ChatbotConversationLite = Pick<
  ChatbotConversation,
  | "id"
  | "status"
  | "messages"
  | "messageCount"
  | "lastMessageAt"
  | "createdAt"
  | "capturedEmail"
  | "capturedName"
  | "pageUrl"
>;

type LeadWithLinks = Lead & {
  visitor: Visitor | null;
  tours: Tour[];
  applications: Application[];
  conversations: ChatbotConversationLite[];
};

// Threshold under which consecutive page views get collapsed into a rollup.
// 15 minutes matches the "session" heuristic most analytics tools use.
const SESSION_GAP_MS = 15 * 60 * 1000;

// Hard cap for standalone (non-rolled-up) page-view events so a crawler
// doesn't overwhelm the timeline.
const MAX_STANDALONE_PAGES = 8;

type RawPageView = {
  url: string;
  ts: Date;
  type?: string | null;
};

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname + (u.search || "")) || "/";
  } catch {
    return url;
  }
}

function parsePagesViewed(raw: unknown): RawPageView[] {
  if (!Array.isArray(raw)) return [];
  const out: RawPageView[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url : null;
    const ts = typeof rec.ts === "string" ? new Date(rec.ts) : null;
    if (!url || !ts || Number.isNaN(ts.getTime())) continue;
    const type = typeof rec.type === "string" ? rec.type : null;
    out.push({ url, ts, type });
  }
  return out;
}

// Group consecutive page views (sorted ASC by ts) whose neighbors fall within
// SESSION_GAP_MS. Returns an array of groups in ASC order.
function groupPageViews(pages: RawPageView[]): RawPageView[][] {
  if (pages.length === 0) return [];
  const sorted = [...pages].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const groups: RawPageView[][] = [];
  let current: RawPageView[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.ts.getTime() - prev.ts.getTime() <= SESSION_GAP_MS) {
      current.push(curr);
    } else {
      groups.push(current);
      current = [curr];
    }
  }
  groups.push(current);
  return groups;
}

export function buildTimeline(lead: LeadWithLinks): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Lead creation — always present
  events.push({
    kind: "lead_created",
    id: `lead-created-${lead.id}`,
    ts: lead.firstSeenAt,
    source: lead.source,
    sourceDetail: lead.sourceDetail,
  });

  // Pixel events from the linked visitor
  if (lead.visitor) {
    events.push({
      kind: "pixel_first_seen",
      id: `visitor-first-${lead.visitor.id}`,
      ts: lead.visitor.firstSeenAt,
      referrer: lead.visitor.referrer,
      utmSource: lead.visitor.utmSource,
    });

    const pages = parsePagesViewed(lead.visitor.pagesViewed);
    const groups = groupPageViews(pages);

    for (const group of groups) {
      if (group.length === 1 || group.length <= MAX_STANDALONE_PAGES && group.length <= 2) {
        // Single or very short burst — render individually for maximum detail
        for (const page of group) {
          events.push({
            kind: "pixel_page_view",
            id: `pv-${lead.visitor.id}-${page.ts.getTime()}-${page.url}`,
            ts: page.ts,
            url: page.url,
            path: safePath(page.url),
            eventType: page.type ?? null,
          });
        }
      } else {
        // Rollup: 3+ pages within one session → condensed event
        const last = group[group.length - 1];
        events.push({
          kind: "pixel_page_rollup",
          id: `pv-rollup-${lead.visitor.id}-${last.ts.getTime()}`,
          ts: last.ts,
          startedAt: group[0].ts,
          pages: group.map((p) => ({
            url: p.url,
            path: safePath(p.url),
            ts: p.ts,
          })),
        });
      }
    }
  }

  // Chatbot conversations — one event each
  for (const convo of lead.conversations) {
    events.push({
      kind: "chatbot_conversation",
      id: `chat-${convo.id}`,
      ts: convo.lastMessageAt ?? convo.createdAt,
      conversation: convo,
    });
  }

  // Tours
  for (const tour of lead.tours) {
    events.push({
      kind: "tour",
      id: `tour-${tour.id}`,
      ts: tour.scheduledAt ?? tour.createdAt,
      tour,
    });
  }

  // Applications
  for (const application of lead.applications) {
    events.push({
      kind: "application",
      id: `app-${application.id}`,
      ts: application.appliedAt ?? application.createdAt,
      application,
    });
  }

  // Lease signed — convertedAt
  if (lead.convertedAt) {
    events.push({
      kind: "status_signed",
      id: `signed-${lead.id}`,
      ts: lead.convertedAt,
    });
  }

  // Sort newest first
  return events.sort((a, b) => b.ts.getTime() - a.ts.getTime());
}
