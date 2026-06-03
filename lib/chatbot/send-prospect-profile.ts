import "server-only";
import { prisma } from "@/lib/db";
import { sendBrandedEmail, APP_URL } from "@/lib/email/shared";
import { buildProspectProfileEmail } from "@/lib/email/prospect-profile-email";
import {
  extractProspectProfile,
  type ProspectProfile,
} from "./extract-prospect-profile";

// ---------------------------------------------------------------------------
// sendProspectProfileForConversation — single entry point used by both the
// idle-digest cron and the operator handoff route. Loads the conversation,
// extracts a fresh profile via Claude, persists it, sends a rich email to
// the org's notifyLeadEmail (per-property override respected), and stamps
// prospectProfileEmailedAt so repeat firings are suppressed.
//
// Idempotency: a row with prospectProfileEmailedAt < N minutes ago is
// skipped unless { force: true }. The handoff route always passes force
// so the operator's "send now" intent overrides the de-bounce.
//
// NEVER throws. Email-related infra is decorative around the chat flow.
// ---------------------------------------------------------------------------

const MIN_RESEND_INTERVAL_MS = 30 * 60 * 1000; // 30 min default debounce

export type SendProspectProfileArgs = {
  conversationId: string;
  /** Override the de-bounce — used by the handoff route. */
  force?: boolean;
  /** Optional reason tag for logging. */
  reason?: string;
};

export type SendProspectProfileResult =
  | { ok: true; sent: true; profile: ProspectProfile }
  | { ok: true; sent: false; skipped: string }
  | { ok: false; error: string };

export async function sendProspectProfileForConversation(
  args: SendProspectProfileArgs,
): Promise<SendProspectProfileResult> {
  const convo = await prisma.chatbotConversation
    .findUnique({
      where: { id: args.conversationId },
      select: {
        id: true,
        orgId: true,
        propertyId: true,
        messages: true,
        messageCount: true,
        lastMessageAt: true,
        capturedName: true,
        capturedEmail: true,
        capturedPhone: true,
        prospectProfile: true,
        prospectProfileEmailedAt: true,
        pageUrl: true,
      },
    })
    .catch(() => null);
  if (!convo) {
    return { ok: false, error: "conversation not found" };
  }
  if (convo.messageCount === 0) {
    return { ok: true, sent: false, skipped: "no messages" };
  }

  // Debounce: don't re-fire a digest for the same conversation within
  // MIN_RESEND_INTERVAL_MS unless force is set.
  if (
    !args.force &&
    convo.prospectProfileEmailedAt &&
    Date.now() - convo.prospectProfileEmailedAt.getTime() <
      MIN_RESEND_INTERVAL_MS
  ) {
    return { ok: true, sent: false, skipped: "recently emailed" };
  }

  const [org, property] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: convo.orgId },
      select: {
        name: true,
        shortName: true,
        notifyLeadEmail: true,
        notifyOnChatbotLead: true,
      },
    }),
    convo.propertyId
      ? prisma.property.findUnique({
          where: { id: convo.propertyId },
          select: { name: true, notifyLeadEmailOverride: true },
        })
      : Promise.resolve(null),
  ]);
  if (!org) {
    return { ok: false, error: "org missing" };
  }
  if (!(org.notifyOnChatbotLead ?? true)) {
    return { ok: true, sent: false, skipped: "channel disabled" };
  }
  const recipients = splitRecipients(
    property?.notifyLeadEmailOverride ?? org.notifyLeadEmail ?? null,
  );
  if (recipients.length === 0) {
    return {
      ok: true,
      sent: false,
      skipped: `notifyLeadEmail not set for org ${convo.orgId}`,
    };
  }

  // Run extraction. The messages column is JSONB but is shaped as
  // {role, content, timestamp}[]; defensive cast so an unexpected shape
  // collapses to an empty array rather than throwing.
  const messages = Array.isArray(convo.messages)
    ? (convo.messages as Array<{ role?: string; content?: string }>)
    : [];
  const safeMessages = messages
    .map((m) => ({
      role: typeof m.role === "string" ? m.role : "user",
      content: typeof m.content === "string" ? m.content : "",
    }))
    .filter((m) => m.content.length > 0);

  const profile = await extractProspectProfile({
    messages: safeMessages,
    orgId: convo.orgId,
    conversationId: convo.id,
  });
  if (!profile) {
    return {
      ok: true,
      sent: false,
      skipped: "extraction failed (no ANTHROPIC_API_KEY or model error)",
    };
  }

  // Persist the fresh profile + stamp the emailedAt up front so a Resend
  // failure still suppresses the cron's next fire (it would retry on
  // ` next idle pass anyway via the in-app dashboard).
  await prisma.chatbotConversation
    .update({
      where: { id: convo.id },
      data: {
        prospectProfile: profile as unknown as object,
        prospectProfileEmailedAt: new Date(),
      },
    })
    .catch(() => undefined);

  const { html, text, subject } = buildProspectProfileEmail({
    orgName: org.shortName ?? org.name,
    propertyName: property?.name ?? null,
    portalUrl: `${APP_URL}/portal/conversations/${convo.id}`,
    profile,
    messageCount: convo.messageCount,
    lastMessageAtIso: convo.lastMessageAt.toISOString(),
    pageUrl: convo.pageUrl,
  });

  const result = await sendBrandedEmail({
    to: recipients,
    subject,
    html,
    text,
    template: "chatbot-prospect-profile",
    category: "transactional",
    orgId: convo.orgId,
  }).catch((err) => ({ ok: false as const, error: String(err) }));

  if (!("ok" in result) || !result.ok) {
    return {
      ok: false,
      error: result && "error" in result ? result.error : "send failed",
    };
  }
  return { ok: true, sent: true, profile };
}

function splitRecipients(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
}
