import "server-only";
import { prisma } from "@/lib/db";
import { sendBrandedEmail, APP_URL } from "@/lib/email/shared";
import {
  LeadNotifyChannel,
  LeadNotifyStatus,
  type Prisma,
} from "@prisma/client";
import { buildLeadNotifyEmail } from "@/lib/email/lead-notify-email";
import { pushLeadToFunnel } from "@/lib/integrations/funnel-client";

// ---------------------------------------------------------------------------
// notifyLeadCaptured — single entry point every lead-capture site calls.
//
// Each capture path (chatbot, popup, form, ingest webhook, tour, visitor →
// lead conversion, manual portal add) calls this fire-and-forget after the
// Lead row is persisted. We look up the org's routing address + the matching
// per-channel toggle, write an audit row, render the email, send via Resend,
// and update the row with the outcome.
//
// CRITICAL: this function MUST NEVER throw. Lead creation is the primary
// flow; notifications are secondary. Every error path swallows + logs.
// ---------------------------------------------------------------------------

export type LeadNotifyInput = {
  orgId: string;
  leadId: string;
  propertyId?: string | null;
  channel: LeadNotifyChannel;
  lead: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    sourceLabel?: string | null;
    intent?: string | null;
  };
  conversationId?: string | null;
};

const CHANNEL_TOGGLE = {
  CHATBOT: "notifyOnChatbotLead",
  POPUP: "notifyOnPopupLead",
  FORM: "notifyOnFormLead",
  INGEST: "notifyOnIngestLead",
  TOUR: "notifyOnTourRequest",
  VISITOR_CONVERT: "notifyOnVisitorConvert",
  MANUAL: "notifyOnManualLead",
} as const satisfies Record<LeadNotifyChannel, string>;

function splitRecipients(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
}

function displayName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export async function notifyLeadCaptured(
  input: LeadNotifyInput,
): Promise<void> {
  try {
    const [org, property] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: input.orgId },
        select: {
          name: true,
          shortName: true,
          notifyLeadEmail: true,
          notifyLeadCcEmail: true,
          notifyLeadBccEmail: true,
          notifyOnChatbotLead: true,
          notifyOnPopupLead: true,
          notifyOnFormLead: true,
          notifyOnIngestLead: true,
          notifyOnTourRequest: true,
          notifyOnVisitorConvert: true,
          notifyOnManualLead: true,
        },
      }),
      input.propertyId
        ? prisma.property.findUnique({
            where: { id: input.propertyId },
            select: { name: true, notifyLeadEmailOverride: true },
          })
        : Promise.resolve(null),
    ]);

    if (!org) {
      console.warn("[lead-notify] org not found", input.orgId);
      return;
    }

    // Fail-soft CRM push (Funnel Leasing). This is its OWN side-effect: it
    // fires independent of the email channel toggles below (a CRM sync isn't
    // gated on the operator's email-notification prefs) and independent of
    // whether the Funnel integration is even connected — pushLeadToFunnel
    // silently skips when it isn't. Fired fire-and-forget with a .catch so a
    // Funnel outage / misconfiguration can NEVER throw out of this function or
    // block the Slack/email/bell notifications that follow. pushLeadToFunnel is
    // already internally fail-soft; the .catch is belt-and-suspenders.
    //
    // CHATBOT is deliberately EXCLUDED here. A chatbot lead is captured BEFORE
    // (pre-chat) or partway through (mid-conversation auto-extraction) the
    // conversation, so an inline push would send Funnel an empty / partial
    // transcript in `notes` — and Funnel's POST /clients creates a NEW Prospect
    // every call (no upsert), so we can't just re-push later. Instead the
    // funnel-lead-sync cron pushes chatbot leads ONCE, after the conversation
    // has gone idle, with the full transcript. Every other channel is a
    // complete event at capture time and pushes immediately here.
    if (input.channel !== LeadNotifyChannel.CHATBOT) {
      void pushLeadToFunnel({
        orgId: input.orgId,
        channel: input.channel,
        lead: {
          name: input.lead.name ?? null,
          email: input.lead.email ?? null,
          phone: input.lead.phone ?? null,
          sourceLabel: input.lead.sourceLabel ?? null,
          intent: input.lead.intent ?? null,
        },
        conversationId: input.conversationId ?? null,
      }).catch((err) => console.warn("[lead-notify] funnel push failed", err));
    }

    const channelEnabled = org[CHANNEL_TOGGLE[input.channel]] ?? true;
    const recipients = splitRecipients(
      property?.notifyLeadEmailOverride ?? org.notifyLeadEmail ?? null,
    );
    // CC/BCC are org-level — copy an owner/manager on every notification
    // regardless of which property's address is the primary recipient.
    const ccRecipients = splitRecipients(org.notifyLeadCcEmail);
    const bccRecipients = splitRecipients(org.notifyLeadBccEmail);

    const leadName = displayName(input.lead.name);
    const leadEmail = displayName(input.lead.email);
    const propertyName = property?.name ?? null;
    const orgLabel = org.shortName ?? org.name;
    const subject = `New lead: ${leadName ?? leadEmail ?? "visitor"} — ${propertyName ?? orgLabel}`;

    const payload: Prisma.InputJsonValue = {
      leadName: leadName ?? null,
      leadEmail: leadEmail ?? null,
      leadPhone: displayName(input.lead.phone),
      leadSource: displayName(input.lead.sourceLabel),
      leadIntent: displayName(input.lead.intent),
      propertyName,
      conversationId: input.conversationId ?? null,
    };

    // Audit row written for every attempt (including suppressed) so the
    // operator can answer "was this lead notified?" with one query.
    const baseRow = {
      orgId: input.orgId,
      leadId: input.leadId,
      propertyId: input.propertyId ?? null,
      channel: input.channel,
      subject,
      payload,
    };

    if (!channelEnabled || recipients.length === 0) {
      await prisma.leadNotificationDelivery
        .create({
          data: {
            ...baseRow,
            recipient: recipients.join(", ") || "(none)",
            status: LeadNotifyStatus.SUPPRESSED,
            errorMessage: !channelEnabled
              ? `Channel ${input.channel} disabled for org`
              : "No notifyLeadEmail configured",
          },
        })
        .catch((err) =>
          console.warn("[lead-notify] suppressed insert failed:", err),
        );
      return;
    }

    const delivery = await prisma.leadNotificationDelivery
      .create({
        data: {
          ...baseRow,
          recipient: recipients.join(", "),
          status: LeadNotifyStatus.PENDING,
          attempts: 1,
        },
      })
      .catch((err) => {
        console.warn("[lead-notify] pending insert failed:", err);
        return null;
      });

    // Chatbot leads link to the live conversation so the operator can
    // engage in real time. Every other channel still lands on the lead
    // detail page where the activity history is the right primary
    // surface. Adam 2026-06-03: Jessica @ TC needs the chat URL ONE
    // CLICK from the inbox, not two.
    const portalUrl =
      input.channel === "CHATBOT" && input.conversationId
        ? `${APP_URL}/portal/conversations/${input.conversationId}`
        : `${APP_URL}/portal/leads/${input.leadId}`;

    const { html, text } = buildLeadNotifyEmail({
      orgName: orgLabel,
      subject,
      lead: {
        name: leadName,
        email: leadEmail,
        phone: displayName(input.lead.phone),
        sourceLabel: displayName(input.lead.sourceLabel),
        intent: displayName(input.lead.intent),
      },
      propertyName,
      portalUrl,
      channel: input.channel,
    });

    const result = await sendBrandedEmail({
      to: recipients,
      ...(ccRecipients.length > 0 ? { cc: ccRecipients } : {}),
      ...(bccRecipients.length > 0 ? { bcc: bccRecipients } : {}),
      subject,
      html,
      text,
      template: "lead-notify",
      category: "transactional",
      orgId: input.orgId,
    });

    if (!delivery) return;

    const updateData = result.ok
      ? {
          status: LeadNotifyStatus.SENT,
          resendId: result.id ?? null,
          sentAt: new Date(),
        }
      : {
          status: LeadNotifyStatus.FAILED,
          errorMessage: result.error ?? "unknown",
        };

    await prisma.leadNotificationDelivery
      .update({ where: { id: delivery.id }, data: updateData })
      .catch((err) => console.warn("[lead-notify] status update failed:", err));

    if (!result.ok) {
      console.error(
        "[lead-notify] failed",
        result.error ?? "unknown",
        input.channel,
        input.leadId,
      );
    }
  } catch (err) {
    // Final catch — NEVER let an error escape this helper. Lead capture must
    // never fail because notifications failed.
    console.error("[lead-notify] failed", err);
  }
}
