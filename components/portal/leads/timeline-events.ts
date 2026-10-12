// ---------------------------------------------------------------------------
// Timeline event builder for the Lead detail page.
//
// Merges signals into one chronological feed:
//   - Lead creation           (Lead.firstSeenAt)
//   - Chatbot conversations   (ChatbotConversation rows)
//   - Tours                   (Tour rows)
//   - Applications            (Application rows)
// ---------------------------------------------------------------------------
import type {
  Application,
  ChatbotConversation,
  Lead,
  Tour,
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
    }
  | {
      kind: "review_request_sent";
      id: string;
      ts: Date;
    }
  | {
      kind: "popup_event";
      id: string;
      ts: Date;
      // type carries the PopupEventType ("IMPRESSION" | "INTERACTION" |
      // "CONVERTED" | etc). Render reads the type to pick a sentence
      // ("Saw the welcome popup" vs "Converted via the move-in popup").
      eventType: string;
      campaignName: string | null;
      pageUrl: string | null;
    }
  | {
      kind: "email_sent";
      id: string;
      ts: Date;
      // Either an automated cadence stage ("day_one", "day_three") or a
      // free-text label for ad-hoc / composed emails.
      label: string;
      subject: string | null;
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

export type PopupEventLite = {
  id: string;
  type: string;
  occurredAt: Date;
  pageUrl: string | null;
  campaignName: string | null;
};

export type EmailEventLite = {
  id: string;
  label: string;
  subject: string | null;
  sentAt: Date;
};

type LeadWithLinks = Lead & {
  tours: Tour[];
  applications: Application[];
  conversations: ChatbotConversationLite[];
  popupEvents?: PopupEventLite[];
  emailEvents?: EmailEventLite[];
};

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

  // Review request sent (manual or auto via cron)
  if (lead.reviewRequestSentAt) {
    events.push({
      kind: "review_request_sent",
      id: `review-${lead.id}`,
      ts: lead.reviewRequestSentAt,
    });
  }

  // Popup events linked to this lead (impressions, interactions,
  // conversions). The CONVERTED event is what fired the lead create;
  // impressions/interactions are upstream — together they explain how
  // this lead got from "saw a popup" to "submitted the form."
  if (lead.popupEvents) {
    for (const p of lead.popupEvents) {
      events.push({
        kind: "popup_event",
        id: `popup-${p.id}`,
        ts: p.occurredAt,
        eventType: p.type,
        campaignName: p.campaignName,
        pageUrl: p.pageUrl,
      });
    }
  }

  // Email cadence + composer events from EmailEvent (or surfaced
  // by the caller from Lead.emailsSent + lastEmailSentAt + cadenceStage
  // when no audit table is available).
  if (lead.emailEvents) {
    for (const e of lead.emailEvents) {
      events.push({
        kind: "email_sent",
        id: `email-${e.id}`,
        ts: e.sentAt,
        label: e.label,
        subject: e.subject,
      });
    }
  }

  // Sort newest first
  return events.sort((a, b) => b.ts.getTime() - a.ts.getTime());
}
