import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "@/lib/db";
import {
  ChatbotConversationStatus,
  LeadSource,
  Prisma,
  TenantStatus,
} from "@prisma/client";
import {
  buildSystemPrompt,
  type ChatbotTenant,
} from "@/lib/chatbot/build-system-prompt";
import { extractLeadCapture } from "@/lib/chatbot/extract-lead";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";
import { notifyChatbotLeadCaptured } from "@/lib/notifications/create";
import { sendProspectProfileForConversation } from "@/lib/chatbot/send-prospect-profile";
import { LeadNotifyChannel } from "@prisma/client";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";
import { resolvePropertyForChatPage } from "@/lib/chatbot/property-attribution";
import { resolveChatbotConfig } from "@/lib/chatbot/resolve-config";
import { parseFloorPlans } from "@/lib/properties/kb-completeness";
import {
  publicApiLimiter,
  checkRateLimit,
  getIp,
  WIDGET_FALLBACK,
} from "@/lib/rate-limit";
import { checkAiQuota } from "@/lib/ai/quota";
import { requireMatchingOrigin } from "@/lib/tenancy/origin-guard";
import {
  exceedsChatInputBudget,
  MAX_CHAT_OUTPUT_TOKENS,
} from "@/lib/chatbot/input-budget";
import * as Sentry from "@sentry/nextjs";

// POST /api/public/chatbot/chat
//
// Public, CORS-enabled chat endpoint for the embed widget. Slug-routed,
// streams Claude Haiku 4.5 replies, persists the conversation + auto-creates
// a Lead when an email is captured. Mirrors the admin /api/chatbot flow but
// is explicitly cross-origin safe.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const body = z.object({
  slug: z.string().min(1).max(120),
  sessionId: z.string().uuid(),
  messages: z.array(chatMessage).min(1).max(50),
  pageUrl: z.string().optional(),
  // Explicit property slug the widget loaded its config with. Authoritative
  // when present — keeps the chat's property in lockstep with the config that
  // was served, instead of re-guessing from pageUrl. (Codex tenant-isolation.)
  property: z.string().min(1).max(120).optional(),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicApiLimiter, ip, {
    softFallback: WIDGET_FALLBACK.publicApi,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "60" } }
    );
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const parsed = body.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const { slug, sessionId, messages, pageUrl, property: propertySlug } =
    parsed.data;

  // Denial-of-Wallet: cap aggregate input size per request (each message is
  // already ≤4000 chars, but 50 of them is ~50K input tokens). See input-budget.
  if (exceedsChatInputBudget(messages)) {
    return NextResponse.json(
      { error: "Conversation too long" },
      { status: 413, headers: CORS_HEADERS }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      tenantSiteConfig: true,
      properties: {
        orderBy: { updatedAt: "desc" },
        include: { listings: { where: { isAvailable: true } } },
      },
    },
  });
  if (!org || org.orgType !== "CLIENT" || !org.moduleChatbot) {
    return NextResponse.json(
      { error: "Chatbot not enabled for this tenant" },
      { status: 403, headers: CORS_HEADERS }
    );
  }
  // Per-property enablement is checked AFTER we resolve which property this
  // chat belongs to (below) — a property may enable the bot even when the org
  // default is off, or vice-versa. We still require SOME chatbot config to
  // exist so a brand-new org with no config can't stream.
  if (!org.tenantSiteConfig) {
    return NextResponse.json(
      { error: "Chatbot disabled" },
      { status: 403, headers: CORS_HEADERS }
    );
  }
  if (
    org.status === TenantStatus.CHURNED ||
    org.status === TenantStatus.PAUSED
  ) {
    return NextResponse.json(
      { error: "Chatbot unavailable" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  const orgId = org.id;

  // Origin guard (SECURITY_AUDIT L2). Before this check, an attacker who
  // scraped a tenant's slug (public, leaks via /api/public/chatbot/config)
  // could call this endpoint from any origin and bill our Anthropic budget
  // against that tenant's daily quota.
  //
  // requireMatchingOrigin resolves the request's Origin/Referer hostname via
  // the same path the middleware uses (DomainBinding.hostname for custom
  // domains, then {slug}.{PLATFORM_DOMAIN} subdomain fallback). The legit
  // embed widget is loaded from the tenant's own marketing site, so its
  // Origin header always matches one of these.
  //
  // CHATBOT_ALLOW_ANY_ORIGIN=true bypasses the check for local dev where
  // the widget is loaded from localhost or a Vercel preview URL that isn't
  // bound to any tenant.
  if (process.env.CHATBOT_ALLOW_ANY_ORIGIN !== "true") {
    const guard = await requireMatchingOrigin(req, orgId);
    if (!guard.ok) {
      // Sentry breadcrumb at warning level so we can spot abuse patterns
      // without paging on legitimate misconfigured embeds. Intentionally
      // does NOT include any API key / secret in tags — only the orgId
      // claimed by the request and the offending hostname.
      const offendingOrigin =
        req.headers.get("origin") ?? req.headers.get("referer") ?? "(none)";
      Sentry.withScope((scope) => {
        scope.setLevel("warning");
        scope.setTag("route", "public/chatbot/chat");
        scope.setTag("orgId", orgId);
        scope.setTag("offendingOrigin", offendingOrigin);
        Sentry.captureMessage("chatbot.chat origin not allowed");
      });
      return NextResponse.json(
        { error: "origin not allowed" },
        { status: 403, headers: CORS_HEADERS }
      );
    }
  }

  // Per-org daily AI quota backstop. Far above legitimate volume (default
  // 1000 calls/day) — primary protection is the per-IP publicApiLimiter
  // above. This exists so a single tenant can't quietly drain the
  // Anthropic budget before anyone notices. Fails OPEN on Redis errors;
  // see lib/ai/quota.ts.
  const quota = await checkAiQuota(orgId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Chatbot temporarily unavailable",
        details: { code: "ai_quota_exceeded" },
      },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "3600" } }
    );
  }

  // Look up the conversation's captured contact info (pre-chat capture
  // form + any prior in-conversation extraction). Pre-chat capture lands
  // capturedName / capturedEmail / capturedPhone on the row BEFORE the
  // first message is sent — without threading those into the system
  // prompt the bot asks for the email again on its first reply (and then
  // asks the user to "confirm" when they re-type it, which was Adam's
  // exact bug report 2026-06-03). Best-effort: a lookup miss collapses
  // to undefined and the bot falls back to the contact-capture script.
  // SCOPED BY orgId (Codex tenant-isolation): sessionId is globally unique but
  // client-supplied, so a findUnique by sessionId alone would inject ANOTHER
  // tenant's captured name/email/phone into this tenant's system prompt (and
  // let it be read back out of the bot). findFirst keyed on { sessionId, orgId }
  // returns only this tenant's row.
  const captured = await prisma.chatbotConversation
    .findFirst({
      where: { sessionId, orgId },
      select: { capturedName: true, capturedEmail: true, capturedPhone: true },
    })
    .catch(() => null);

  // Resolve WHICH property this chat is for, most-authoritative first:
  //  1. the explicit property slug the widget loaded its config with,
  //  2. inference from the host pageUrl,
  //  3. the org's only property (unambiguous for single-property tenants).
  // For a MULTI-property tenant we could not resolve, stay null — never
  // silently pick properties[0], which mis-attributed leads + served the wrong
  // property's config/prompt. (Codex tenant-isolation.)
  const explicitProperty = propertySlug
    ? (org.properties.find((p) => p.slug === propertySlug) ?? null)
    : null;
  const resolvedPropertyId =
    explicitProperty?.id ??
    resolvePropertyForChatPage(
      pageUrl,
      org.properties.map((p) => ({ id: p.id, slug: p.slug, name: p.name })),
    ) ??
    (org.properties.length === 1 ? (org.properties[0]?.id ?? null) : null);
  const promptProperty =
    org.properties.find((p) => p.id === resolvedPropertyId) ?? null;

  // Resolve the per-property chatbot config (knowledge base, persona, capture
  // mode, contact, CTA) with field-level fallback to the org default. A
  // property may override the enable toggle either way; gate on the resolved
  // value so a property-specific bot serves even if the org default is off.
  const resolvedConfig = await resolveChatbotConfig(orgId, resolvedPropertyId);
  if (!resolvedConfig.chatbotEnabled) {
    return NextResponse.json(
      { error: "Chatbot disabled" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  // Structured per-property knowledge base (slice "Property Knowledge Base"
  // S1). Scoped by orgId via the property relation (tenant isolation) so a
  // cross-tenant propertyId can never merge another org's facts into this
  // prompt. Best-effort: a miss yields null and the bot falls back to the
  // anti-invention deflection copy.
  const kbRow = resolvedPropertyId
    ? await prisma.propertyKnowledgeBase
        .findFirst({
          // Double-scope: the KB row's own orgId AND its property's orgId must
          // both match this tenant. If a property were ever reassigned across
          // orgs, the now-stale KB row simply won't load (bot deflects) rather
          // than injecting the prior tenant's facts. (Codex tenant-isolation.)
          where: { propertyId: resolvedPropertyId, orgId, property: { orgId } },
        })
        .catch(() => null)
    : null;
  const knowledgeBase = kbRow
    ? { ...kbRow, floorPlans: parseFloorPlans(kbRow.floorPlans) }
    : null;

  const systemPrompt = buildSystemPrompt(
    org as ChatbotTenant,
    {
      name: captured?.capturedName ?? null,
      email: captured?.capturedEmail ?? null,
      phone: captured?.capturedPhone ?? null,
    },
    { property: promptProperty, config: resolvedConfig, knowledgeBase },
  );
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    messages,
    // Denial-of-Wallet: bound the reply so a single call can't be prompted
    // into an unbounded (expensive) generation.
    maxOutputTokens: MAX_CHAT_OUTPUT_TOKENS,
    onFinish: async ({ text }) => {
      try {
        // Same markdown stripper the client renderer uses, so the
        // persisted transcript matches what the visitor actually saw on
        // screen. Without this, the conversation inbox shows raw "**foo**"
        // while the live chat showed "foo".
        await persistConversation({
          orgId,
          sessionId,
          messages,
          replyText: stripChatbotMarkdown(text),
          pageUrl,
          userAgent,
          ipAddress: ip,
          // Resolved property only — null when genuinely ambiguous, so a lead
          // is never mis-attributed to an arbitrary property. (Codex.)
          propertyId: resolvedPropertyId,
        });
      } catch (err) {
        console.error("[public/chatbot/chat] persistence error:", err);
      }
    },
  });

  return result.toTextStreamResponse({
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

async function persistConversation(args: {
  orgId: string;
  sessionId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  replyText: string;
  pageUrl?: string;
  userAgent?: string;
  ipAddress?: string;
  propertyId?: string | null;
}) {
  const full = [
    ...args.messages,
    { role: "assistant" as const, content: args.replyText },
  ];
  const extracted = extractLeadCapture(full);
  const isLeadCaptured = Boolean(extracted.email);
  const now = new Date();

  const serializedMessages = full.map((m) => ({
    role: m.role,
    content: m.content,
    ts: now.toISOString(),
  })) as unknown as Prisma.InputJsonValue;

  const existing = await prisma.chatbotConversation.findUnique({
    where: { sessionId: args.sessionId },
    select: { id: true, orgId: true, leadId: true, status: true },
  });

  let conversation;
  if (existing) {
    if (existing.orgId !== args.orgId) {
      // Cross-tenant sessionId reuse — refuse silently. The session belongs to
      // a different org. Returning early prevents data corruption; the caller
      // can recover by generating a fresh sessionId on the client.
      return null;
    }
    // Status state machine: once LEAD_CAPTURED, stay LEAD_CAPTURED. The
    // PRE_CHAT path inserts a row with leadId set + status=LEAD_CAPTURED
    // before any messages exist; subsequent /chat calls would otherwise
    // demote it back to ACTIVE because extractLeadCapture finds nothing
    // in the (so-far empty) message history. Preserve the higher state.
    const alreadyCaptured =
      existing.leadId != null ||
      existing.status === ChatbotConversationStatus.LEAD_CAPTURED;
    const nextStatus = alreadyCaptured || isLeadCaptured
      ? ChatbotConversationStatus.LEAD_CAPTURED
      : ChatbotConversationStatus.ACTIVE;
    conversation = await prisma.chatbotConversation.update({
      where: { id: existing.id },
      data: {
        messages: serializedMessages,
        messageCount: full.length,
        lastMessageAt: now,
        status: nextStatus,
        capturedName: extracted.name ?? undefined,
        capturedEmail: extracted.email ?? undefined,
        capturedPhone: extracted.phone ?? undefined,
      },
    });
  } else {
    conversation = await prisma.chatbotConversation.create({
      data: {
        orgId: args.orgId,
        sessionId: args.sessionId,
        messages: serializedMessages,
        messageCount: full.length,
        status: isLeadCaptured
          ? ChatbotConversationStatus.LEAD_CAPTURED
          : ChatbotConversationStatus.ACTIVE,
        capturedName: extracted.name ?? null,
        capturedEmail: extracted.email ?? null,
        capturedPhone: extracted.phone ?? null,
        propertyId: args.propertyId ?? null,
        pageUrl: args.pageUrl ?? null,
        userAgent: args.userAgent ?? null,
        ipAddress: args.ipAddress ?? null,
      },
    });
  }

  if (isLeadCaptured && !conversation.leadId && extracted.email) {
    const lead = await prisma.lead.create({
      data: {
        orgId: args.orgId,
        propertyId: args.propertyId ?? null,
        source: LeadSource.CHATBOT,
        sourceDetail: args.pageUrl ? `chatbot:${args.pageUrl}` : "chatbot",
        firstName: extracted.firstName ?? null,
        lastName: extracted.lastName ?? null,
        email: extracted.email.toLowerCase(),
        phone: extracted.phone ?? null,
        notes: `Captured by chatbot on ${args.pageUrl ?? "site"}`,
      },
    });
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { leadId: lead.id },
    });

    // Fire-and-forget notifications. PRE_CHAT flow already seeds a leadId
    // on the conversation before the first message, so the guard above
    // (!conversation.leadId) ensures we don't double-send.
    //
    // Both surfaces matter: notifyLeadCaptured is the Resend email to the
    // operator's primary contact; notifyChatbotLeadCaptured is the in-app
    // bell badge in /portal. Pre-fix this branch only sent email — the
    // POST_CHAT bell notification was silently dropped (PRE_CHAT path in
    // /api/public/chatbot/lead already sends both).
    void notifyLeadCaptured({
      orgId: args.orgId,
      leadId: lead.id,
      propertyId: args.propertyId ?? null,
      channel: LeadNotifyChannel.CHATBOT,
      lead: {
        name: [extracted.firstName, extracted.lastName]
          .filter(Boolean)
          .join(" ") || null,
        email: extracted.email ?? null,
        phone: extracted.phone ?? null,
        sourceLabel: args.pageUrl ? `Chatbot on ${args.pageUrl}` : "Chatbot",
      },
      conversationId: conversation.id,
    }).catch((err) => {
      console.warn("[public/chatbot/chat] notify email error:", err);
    });
    void notifyChatbotLeadCaptured({
      id: conversation.id,
      orgId: args.orgId,
      capturedName: extracted.name ?? null,
      capturedEmail: extracted.email,
      leadId: lead.id,
    }).catch((err) => {
      console.warn("[public/chatbot/chat] notify bell error:", err);
    });

    // Adam 2026-06-03: when the bot auto-detects a lead mid-conversation
    // (regex finds email/phone), ALSO immediately fire the rich
    // prospect-profile digest email — same payload Jessica gets at
    // handoff / idle. The minimal notifyLeadCaptured email above is
    // the "they just shared contact info" ping; this is the "here's
    // the full conversation context they shared, here's the link to
    // engage now" ping. Both fire so the operator can act fast.
    // force=true overrides the 30-min debounce so a re-capture (e.g.
    // operator restarts conversation) still produces a fresh send.
    void sendProspectProfileForConversation({
      conversationId: conversation.id,
      force: true,
      reason: "auto-capture",
    }).catch((err) => {
      console.warn("[public/chatbot/chat] prospect-profile error:", err);
    });
  }
}
