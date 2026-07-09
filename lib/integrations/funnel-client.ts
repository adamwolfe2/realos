import "server-only";
import { prisma } from "@/lib/db";
import { encryptForOrg, decryptForOrg, type EncryptedSecret } from "@/lib/vault/crypto";
import { LeadNotifyChannel } from "@prisma/client";

// ---------------------------------------------------------------------------
// Funnel Leasing (funnelleasing.com) Customer API client — OUTBOUND ONLY.
//
// When a lead is captured and the org has a connected + enabled
// FunnelIntegration, we create a Prospect ("client") in their Funnel account:
//
//   POST {apiBaseUrl}/api/v2/clients
//   Authorization: Basic base64("{apiKey}:")   ← username = key, password = ""
//   Body: { client: { first_name, last_name, email, group, ...notes/people } }
//
// EVERYTHING account-specific is operator-supplied — we never hardcode or guess
// a host, group id, or discovery-source. The `apiBaseUrl` in particular is a
// real unknown: the docs we have never showed Funnel's actual API host, so it
// MUST be confirmed with the client / Funnel support before the first real
// push. The integration ships fully-built-but-disconnected until then.
//
// This module is split into a pure, network-free payload builder
// (buildFunnelProspectPayload — unit-tested) and a fail-soft pushLeadToFunnel
// that reads+decrypts creds and calls the API. pushLeadToFunnel NEVER throws:
// a Funnel outage / misconfiguration / not-yet-connected state must never
// break lead capture or the sibling Slack/email/bell notifications.
// ---------------------------------------------------------------------------

/** Minimal captured-lead shape the push needs. Mirrors LeadNotifyInput.lead. */
export type FunnelLeadInput = {
  /** Full display name (we split into first/last for Funnel). */
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Human label of where the lead came from — folded into the note. */
  sourceLabel?: string | null;
  /** Stated intent, when known. */
  intent?: string | null;
};

/** One chat turn, as stored in ChatbotConversation.messages JSON. */
export type FunnelConversationMessage = {
  role?: string | null;
  content?: string | null;
  timestamp?: string | number | null;
};

export type FunnelConversation = {
  messages: FunnelConversationMessage[];
};

/** Operator-supplied config that governs the payload (group is required). */
export type FunnelPayloadConfig = {
  /** Funnel's internal grouping id for the account. Required by the API. */
  groupId: number;
  /** Discovery-source id from the account's own list. Optional. */
  discoverySourceId?: string | null;
};

/** The exact request body Funnel expects. Nested under `client`. */
export type FunnelProspectRequest = {
  client: {
    first_name: string;
    last_name: string;
    email: string;
    group: number;
    phone_1?: string;
    notes?: string;
    source_type?: string;
    discovery_source_id?: string;
    people: Array<{
      first_name: string;
      last_name: string;
      email: string;
      phone_1?: string;
      is_primary: boolean;
    }>;
  };
};

// Funnel's people/prospect records require a non-empty last name. When a lead
// only gave a single token (chatbots frequently capture just a first name) we
// use a stable placeholder rather than sending an empty string the API rejects.
const LAST_NAME_FALLBACK = "—";

/** Split a free-text display name into first / last for Funnel's schema. */
function splitName(name: string | null | undefined): {
  first: string;
  last: string;
} {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { first: "", last: LAST_NAME_FALLBACK };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: LAST_NAME_FALLBACK };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Format a chatbot transcript into Funnel's free-text `notes` field. */
export function formatConversationNotes(
  conversation: FunnelConversation,
  sourceLabel?: string | null,
): string {
  const header = sourceLabel
    ? `LeaseStack chatbot conversation — ${sourceLabel}`
    : "LeaseStack chatbot conversation";
  const lines = (conversation.messages ?? [])
    .map((m) => {
      const content = (m.content ?? "").trim();
      if (!content) return null;
      const who =
        m.role === "assistant" || m.role === "bot"
          ? "Assistant"
          : m.role === "user" || m.role === "visitor"
            ? "Prospect"
            : (m.role ?? "").trim() || "Note";
      return `${who}: ${content}`;
    })
    .filter((l): l is string => l != null);

  if (lines.length === 0) return header;
  return `${header}\n\n${lines.join("\n")}`;
}

/** Short note for non-chatbot channels (form/popup/tour/etc.). */
function shortSourceNote(
  lead: FunnelLeadInput,
  channel: LeadNotifyChannel,
): string {
  const bits: string[] = [`Lead captured via LeaseStack (${channel.toLowerCase()})`];
  if (lead.sourceLabel) bits.push(`Source: ${lead.sourceLabel}`);
  if (lead.intent) bits.push(`Intent: ${lead.intent}`);
  return bits.join("\n");
}

/**
 * Pure, network-free builder for the create-prospect request body. Unit-tested
 * in isolation. Throws only when a genuinely required field is missing (email
 * or a group id) — the caller treats that as a soft skip, never a hard error.
 */
export function buildFunnelProspectPayload(params: {
  lead: FunnelLeadInput;
  channel: LeadNotifyChannel;
  config: FunnelPayloadConfig;
  conversation?: FunnelConversation | null;
}): FunnelProspectRequest {
  const { lead, channel, config, conversation } = params;

  const email = (lead.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Funnel prospect requires an email");
  }
  if (!Number.isInteger(config.groupId)) {
    throw new Error("Funnel prospect requires an integer group id");
  }

  const { first, last } = splitName(lead.name);
  const phone = (lead.phone ?? "").trim();

  // Chatbot leads carry the full transcript; every other channel gets a short
  // source note. Funnel has no Activity/Note endpoint — `notes` is the only
  // place a conversation summary can live.
  const notes =
    channel === LeadNotifyChannel.CHATBOT && conversation
      ? formatConversationNotes(conversation, lead.sourceLabel)
      : shortSourceNote(lead, channel);

  const client: FunnelProspectRequest["client"] = {
    first_name: first,
    last_name: last,
    email,
    group: config.groupId,
    notes,
    people: [
      {
        first_name: first,
        last_name: last,
        email,
        is_primary: true,
        ...(phone ? { phone_1: phone } : {}),
      },
    ],
  };

  if (phone) client.phone_1 = phone;
  if (lead.sourceLabel) client.source_type = lead.sourceLabel;
  if (config.discoverySourceId) {
    client.discovery_source_id = config.discoverySourceId;
  }

  return { client };
}

/** Input to the fail-soft push. Mirrors what notifyLeadCaptured already holds. */
export type PushLeadToFunnelInput = {
  orgId: string;
  channel: LeadNotifyChannel;
  lead: FunnelLeadInput;
  /** Chatbot conversation to pull a transcript from, when channel === CHATBOT. */
  conversationId?: string | null;
};

export type PushLeadToFunnelResult =
  | { ok: true }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

/**
 * Fail-soft outbound push. Reads + decrypts the org's FunnelIntegration, builds
 * the payload, POSTs it with HTTP Basic auth, and records lastPushAt/lastError.
 *
 * NEVER throws. Every failure path (not connected, disabled, missing config,
 * decrypt failure, network error, non-2xx response) is caught and returned as a
 * value, and best-effort persisted to lastError. The lead-capture flow and the
 * sibling notifications must be completely insulated from Funnel's health.
 */
export async function pushLeadToFunnel(
  input: PushLeadToFunnelInput,
): Promise<PushLeadToFunnelResult> {
  try {
    const integration = await prisma.funnelIntegration
      .findUnique({
        where: { orgId: input.orgId },
        select: {
          apiKeyEncrypted: true,
          apiBaseUrl: true,
          groupId: true,
          discoverySourceId: true,
          enabled: true,
        },
      })
      .catch(() => null);

    // Not connected / not enabled → silent skip (the common, healthy state
    // before an operator wires their account up).
    if (!integration || !integration.enabled) {
      return { ok: false, skipped: true, reason: "not enabled" };
    }
    if (
      !integration.apiKeyEncrypted ||
      !integration.apiBaseUrl ||
      integration.groupId == null
    ) {
      return {
        ok: false,
        skipped: true,
        reason: "missing api key, base URL, or group id",
      };
    }

    // We need an email to create a prospect. Skip quietly when absent rather
    // than recording a scary error the operator can't act on.
    if (!input.lead.email || input.lead.email.trim().length === 0) {
      return { ok: false, skipped: true, reason: "lead has no email" };
    }

    let apiKey: string;
    try {
      const parsed = JSON.parse(integration.apiKeyEncrypted) as EncryptedSecret;
      apiKey = await decryptForOrg(input.orgId, parsed);
    } catch (err) {
      await recordError(
        input.orgId,
        "Could not decrypt Funnel API key",
      );
      console.warn("[funnel] api key decrypt failed", err);
      return { ok: false, skipped: false, error: "decrypt failed" };
    }

    // Pull the transcript only for chatbot leads that reference a conversation.
    let conversation: FunnelConversation | null = null;
    if (input.channel === LeadNotifyChannel.CHATBOT && input.conversationId) {
      const convo = await prisma.chatbotConversation
        .findUnique({
          where: { id: input.conversationId },
          select: { messages: true },
        })
        .catch(() => null);
      if (convo) {
        conversation = { messages: coerceMessages(convo.messages) };
      }
    }

    const payload = buildFunnelProspectPayload({
      lead: input.lead,
      channel: input.channel,
      config: {
        groupId: integration.groupId,
        discoverySourceId: integration.discoverySourceId,
      },
      conversation,
    });

    const baseUrl = integration.apiBaseUrl.replace(/\/+$/, "");
    // HTTP Basic: username = API key, password = empty string.
    const auth = Buffer.from(`${apiKey}:`, "utf8").toString("base64");

    const res = await fetch(`${baseUrl}/api/v2/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const detail = body ? ` — ${body.slice(0, 300)}` : "";
      await recordError(
        input.orgId,
        `Funnel API returned ${res.status}${detail}`,
      );
      return {
        ok: false,
        skipped: false,
        error: `HTTP ${res.status}`,
      };
    }

    await prisma.funnelIntegration
      .update({
        where: { orgId: input.orgId },
        data: { lastPushAt: new Date(), lastError: null },
      })
      .catch((err) => console.warn("[funnel] lastPushAt update failed", err));

    return { ok: true };
  } catch (err) {
    // Absolute backstop — nothing escapes this function.
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("[funnel] pushLeadToFunnel failed", err);
    await recordError(input.orgId, message).catch(() => {});
    return { ok: false, skipped: false, error: message };
  }
}

/**
 * Push a chatbot conversation's lead to Funnel, reading the FULL persisted
 * transcript at call time. Used by the funnel-lead-sync cron once a
 * conversation has gone idle — this is why chatbot leads are NOT pushed inline
 * at capture (where the transcript is empty/partial): the cron reads the
 * conversation after the visitor has stopped chatting, so Funnel's `notes` gets
 * the complete Q&A. Delegates to pushLeadToFunnel, which loads the transcript by
 * conversationId and is itself fully fail-soft. NEVER throws.
 *
 * Lead identity fields come from the Lead row (authoritative), falling back to
 * the conversation's captured fields.
 */
export async function pushConversationLeadToFunnel(
  conversationId: string,
): Promise<PushLeadToFunnelResult> {
  try {
    const convo = await prisma.chatbotConversation
      .findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          orgId: true,
          pageUrl: true,
          capturedName: true,
          capturedEmail: true,
          capturedPhone: true,
          lead: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              intent: true,
              sourceDetail: true,
            },
          },
        },
      })
      .catch(() => null);

    if (!convo) {
      return { ok: false, skipped: true, reason: "conversation not found" };
    }

    const lead = convo.lead;
    const name =
      [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim() ||
      convo.capturedName ||
      null;
    const email = lead?.email ?? convo.capturedEmail ?? null;
    const phone = lead?.phone ?? convo.capturedPhone ?? null;

    return await pushLeadToFunnel({
      orgId: convo.orgId,
      channel: LeadNotifyChannel.CHATBOT,
      lead: {
        name,
        email,
        phone,
        sourceLabel: convo.pageUrl ? `Chatbot on ${convo.pageUrl}` : "Chatbot",
        intent: lead?.intent ?? null,
      },
      conversationId: convo.id,
    });
  } catch (err) {
    // Absolute backstop — mirrors pushLeadToFunnel's contract of never throwing.
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("[funnel] pushConversationLeadToFunnel failed", err);
    return { ok: false, skipped: false, error: message };
  }
}

/** Best-effort error persistence. Never throws. */
async function recordError(orgId: string, message: string): Promise<void> {
  await prisma.funnelIntegration
    .update({
      where: { orgId },
      data: { lastError: message.slice(0, 500), lastPushAt: new Date() },
    })
    .catch((err) => console.warn("[funnel] recordError update failed", err));
}

/** ChatbotConversation.messages is stored as loose JSON — coerce defensively. */
function coerceMessages(raw: unknown): FunnelConversationMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({
      role: typeof m.role === "string" ? m.role : null,
      content: typeof m.content === "string" ? m.content : null,
      timestamp:
        typeof m.timestamp === "string" || typeof m.timestamp === "number"
          ? m.timestamp
          : null,
    }));
}

/** Encrypt a Funnel API key for storage. Serializes the envelope to one string. */
export async function encryptFunnelApiKey(
  orgId: string,
  plaintext: string,
): Promise<string> {
  const secret = await encryptForOrg(orgId, plaintext);
  return JSON.stringify(secret);
}
