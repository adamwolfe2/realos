"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, ChatbotCaptureMode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Chatbot config server actions.
//
// These back the /portal/chatbot page. The public embed widget reads the same
// fields via /api/public/chatbot/config?slug=... — keep both in sync when
// the schema evolves.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const KNOWLEDGE_BASE_MAX = 5000;

const captureModeSchema = z.nativeEnum(ChatbotCaptureMode);

const baseStringSchema = z
  .string()
  .optional()
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .transform((v) => (v === "" ? null : v));

const saveSchema = z.object({
  chatbotEnabled: z.boolean(),
  chatbotPersonaName: baseStringSchema.pipe(
    z.string().max(100).nullable()
  ),
  chatbotAvatarUrl: baseStringSchema.pipe(
    z
      .string()
      .url("Avatar URL must be a valid URL")
      .max(500)
      .nullable()
  ),
  chatbotGreeting: baseStringSchema.pipe(
    z.string().max(500).nullable()
  ),
  // Optional second message sent right after the greeting on first
  // open. Supports placeholders {property_name}, {starting_rent},
  // {open_count}, {next_available} — interpolated by the embed
  // widget against live inventory data. Empty/null suppresses the
  // second message entirely.
  chatbotFollowUpMessage: baseStringSchema.pipe(
    z.string().max(500).nullable()
  ),
  chatbotTeaserText: baseStringSchema.pipe(
    z.string().max(200).nullable()
  ),
  chatbotBrandColor: baseStringSchema.pipe(
    z
      .string()
      .regex(HEX_COLOR, "Brand color must be a hex value like #1a1a2e")
      .nullable()
  ),
  chatbotIdleTriggerSeconds: z.coerce
    .number()
    .int()
    .min(0, "Idle trigger must be 0 or greater")
    .max(600, "Idle trigger can't exceed 600 seconds"),
  chatbotCaptureMode: captureModeSchema,
  chatbotKnowledgeBase: baseStringSchema.pipe(
    z
      .string()
      .max(
        KNOWLEDGE_BASE_MAX,
        `Knowledge base can't exceed ${KNOWLEDGE_BASE_MAX} characters`
      )
      .nullable()
  ),
  ga4MeasurementId: baseStringSchema.pipe(
    z
      .string()
      .regex(
        /^G-[A-Z0-9]+$/i,
        "Looks like an invalid GA4 ID — expected format G-XXXXXXXXXX"
      )
      .max(40)
      .nullable()
  ),
  gtmContainerId: baseStringSchema.pipe(
    z
      .string()
      .regex(
        /^GTM-[A-Z0-9]+$/i,
        "Looks like an invalid GTM ID — expected format GTM-XXXXXXX"
      )
      .max(40)
      .nullable()
  ),
});

function parseBool(value: FormDataEntryValue | null): boolean {
  if (value === null) return false;
  const v = String(value).toLowerCase();
  return v === "on" || v === "true" || v === "1" || v === "yes";
}

function firstString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

export async function saveChatbotConfig(
  formData: FormData
): Promise<ActionResult> {
  try {
    const scope = await requireScope();

    const org = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { moduleChatbot: true },
    });
    if (!org) return { ok: false, error: "Organization not found" };

    const raw = {
      chatbotEnabled: parseBool(formData.get("chatbotEnabled")),
      chatbotPersonaName: firstString(formData.get("chatbotPersonaName")),
      chatbotAvatarUrl: firstString(formData.get("chatbotAvatarUrl")),
      chatbotGreeting: firstString(formData.get("chatbotGreeting")),
      chatbotFollowUpMessage: firstString(
        formData.get("chatbotFollowUpMessage")
      ),
      chatbotTeaserText: firstString(formData.get("chatbotTeaserText")),
      chatbotBrandColor: firstString(formData.get("chatbotBrandColor")),
      chatbotIdleTriggerSeconds: firstString(
        formData.get("chatbotIdleTriggerSeconds")
      ),
      chatbotCaptureMode: firstString(formData.get("chatbotCaptureMode")),
      chatbotKnowledgeBase: firstString(formData.get("chatbotKnowledgeBase")),
      ga4MeasurementId: firstString(formData.get("ga4MeasurementId")),
      gtmContainerId: firstString(formData.get("gtmContainerId")),
    };

    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        ok: false,
        error: first?.message ?? "Validation failed",
      };
    }

    // gtmContainerId is not yet a first-class schema column, so we persist it
    // inside the existing customJson Json blob alongside any prior keys.
    // The tenant layout reads it back via readGtmContainerId().
    const existingConfig = await prisma.tenantSiteConfig.findUnique({
      where: { orgId: scope.orgId },
      select: { customJson: true },
    });
    const priorCustom: Record<string, unknown> =
      existingConfig?.customJson && typeof existingConfig.customJson === "object"
        ? (existingConfig.customJson as Record<string, unknown>)
        : {};
    const nextCustom: Record<string, unknown> = { ...priorCustom };
    if (parsed.data.gtmContainerId) {
      nextCustom.gtmContainerId = parsed.data.gtmContainerId;
    } else {
      delete nextCustom.gtmContainerId;
    }

    // Billing gate — refuse to flip the master toggle on when the module
    // isn't active on this plan. We still let operators edit the rest of
    // the fields so they can stage content before billing activates.
    const { gtmContainerId: _gtm, ...persistFields } = parsed.data;
    void _gtm;
    const data = {
      ...persistFields,
      chatbotEnabled: org.moduleChatbot ? parsed.data.chatbotEnabled : false,
      customJson: nextCustom as Prisma.InputJsonValue,
    };

    const config = await prisma.tenantSiteConfig.upsert({
      where: { orgId: scope.orgId },
      update: data as Prisma.TenantSiteConfigUpdateInput,
      create: {
        ...(data as Prisma.TenantSiteConfigUncheckedCreateInput),
        orgId: scope.orgId,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "TenantSiteConfig",
        entityId: config.id,
        description: "Chatbot config updated",
        diff: data as Prisma.InputJsonValue,
      }),
    });

    revalidatePath("/portal/chatbot");
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("saveChatbotConfig failed", err);
    return { ok: false, error: "Failed to save chatbot config" };
  }
}

// ---------------------------------------------------------------------------
// Lead-routing actions. These live on the Organization row (not
// TenantSiteConfig) because the same notifyLeadEmail address is used by
// every channel (chatbot, popup, form, ingest webhook, tour, manual).
// The chatbot settings page surfaces this as a "Lead routing" panel
// because that's where operators look when a chat captures a lead and
// they're trying to figure out where the email goes.
// ---------------------------------------------------------------------------

const leadRoutingSchema = z.object({
  // Comma-separated list of email addresses. Each one is validated.
  // Empty string → null (notifications silently suppressed with a
  // SUPPRESSED row in LeadNotificationDelivery for the audit trail).
  notifyLeadEmail: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .transform((v) => (v === "" ? null : v))
    .refine(
      (v) => {
        if (v === null) return true;
        const parts = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return (
          parts.length > 0 &&
          parts.every((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p))
        );
      },
      {
        message:
          "Enter one or more valid email addresses, comma-separated.",
      },
    ),
  notifyOnChatbotLead: z.boolean(),
});

export type LeadRoutingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateLeadRouting(
  formData: FormData,
): Promise<LeadRoutingActionResult> {
  try {
    const scope = await requireScope();

    const raw = {
      notifyLeadEmail: firstString(formData.get("notifyLeadEmail")),
      notifyOnChatbotLead: parseBool(formData.get("notifyOnChatbotLead")),
    };
    const parsed = leadRoutingSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        ok: false,
        error: first?.message ?? "Validation failed",
      };
    }

    await prisma.organization.update({
      where: { id: scope.orgId },
      data: {
        notifyLeadEmail: parsed.data.notifyLeadEmail,
        notifyOnChatbotLead: parsed.data.notifyOnChatbotLead,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: scope.orgId,
        description: "Updated lead-routing settings",
        diff: {
          notifyLeadEmail: parsed.data.notifyLeadEmail,
          notifyOnChatbotLead: parsed.data.notifyOnChatbotLead,
        } as Prisma.InputJsonValue,
      }),
    });

    revalidatePath("/portal/chatbot");
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("updateLeadRouting failed", err);
    return { ok: false, error: "Failed to update lead routing" };
  }
}

// ---------------------------------------------------------------------------
// sendTestLeadEmail — fire a synthetic prospect-profile email to the
// configured notifyLeadEmail recipients to verify the entire chain
// (Resend domain, suppression list, formatting, deliverability) WITHOUT
// burning a real conversation or an Anthropic extract call. Operator
// clicks the "Send test email" button on /portal/chatbot's Lead
// routing panel; if it arrives in Jessica's inbox, the plumbing is
// healthy. If not, the response carries the specific Resend error so
// we can fix it. Diagnostic-only — never persists anything.
// ---------------------------------------------------------------------------

export type TestEmailResult =
  | { ok: true; sentTo: string[]; resendId: string | null }
  | { ok: false; error: string; details?: string };

export async function sendTestLeadEmail(): Promise<TestEmailResult> {
  try {
    const scope = await requireScope();
    const org = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        name: true,
        shortName: true,
        notifyLeadEmail: true,
        notifyOnChatbotLead: true,
      },
    });
    if (!org) return { ok: false, error: "Organization not found" };
    const recipients = (org.notifyLeadEmail ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes("@"));
    if (recipients.length === 0) {
      return {
        ok: false,
        error:
          "No notifyLeadEmail configured. Save a recipient first, then test.",
      };
    }
    if (!org.notifyOnChatbotLead) {
      return {
        ok: false,
        error:
          "notifyOnChatbotLead is disabled. Enable the channel toggle first.",
      };
    }

    const { buildProspectProfileEmail } = await import(
      "@/lib/email/prospect-profile-email"
    );
    const { sendBrandedEmail, APP_URL } = await import("@/lib/email/shared");

    // Empty-string / empty-array sentinels match the updated
    // ProspectProfile schema (the old nullable shape blew past
    // Anthropic's 16-union limit). See lib/chatbot/extract-prospect-
    // profile.ts for the schema rationale.
    const profile = {
      fullName: "Test Prospect",
      email: "test@example.com",
      phone: "(555) 000-0000",
      moveInDate: "September 1",
      moveOutDate: "",
      leaseTerm: "12 months",
      roomType: "1BR",
      budgetMonthly: "$2,800",
      partySize: "myself + partner",
      occupation: "test scenario",
      employer: "",
      petsAndKids: "one cat",
      reasonForMove: "test send to verify the pipe",
      mustHaves: ["in-unit washer/dryer", "parking"],
      niceToHaves: [],
      competitorsConsidering: [],
      sentiment: "warm" as const,
      followUpNeeded:
        "This is a test email. The real chatbot will send actual prospect profiles to this inbox.",
      notes: "If you see this, the Lead routing pipeline is working end-to-end.",
    };

    const { html, text, subject } = buildProspectProfileEmail({
      orgName: org.shortName ?? org.name,
      propertyName: null,
      portalUrl: `${APP_URL}/portal/conversations/test`,
      profile,
      messageCount: 0,
      lastMessageAtIso: new Date().toISOString(),
      pageUrl: null,
    });

    const result = await sendBrandedEmail({
      to: recipients,
      subject: `[TEST] ${subject}`,
      html,
      text,
      template: "chatbot-prospect-profile-test",
      category: "transactional",
      orgId: scope.orgId,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: "Resend rejected the send",
        details: result.error,
      };
    }
    return {
      ok: true,
      sentTo: recipients,
      resendId: result.id ?? null,
    };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("sendTestLeadEmail failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Test send failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Backfill — re-send the rich prospect-profile email for every chatbot
// conversation in the last N days that captured a lead. Used right
// after an operator first sets notifyLeadEmail — every conversation
// that captured BEFORE the address was set silently dropped a
// SUPPRESSED LeadNotificationDelivery row. This action catches them
// up in one click.
//
// dryRun mode returns the candidate count without firing anything —
// drives the panel's "N captured conversations not yet emailed" badge.
// ---------------------------------------------------------------------------

export type BackfillResult =
  | {
      ok: true;
      candidateCount: number;
      sent: number;
      skipped: number;
      failed: number;
      dryRun: boolean;
      /** Per-conversation outcome reasons for the operator to debug a
       *  failed backfill — empty on dry runs. */
      reasons?: string[];
    }
  | { ok: false; error: string };

export async function backfillChatbotLeadEmails(args: {
  /** Look-back window in days. Default 30. Cap at 365. */
  dayRange?: number;
  /** When true, returns the count without sending. */
  dryRun?: boolean;
}): Promise<BackfillResult> {
  try {
    const scope = await requireScope();
    const days = Math.min(365, Math.max(1, args.dayRange ?? 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dryRun = args.dryRun ?? false;

    // Eligibility for backfill:
    // - Conversation belongs to current org (tenant scope)
    // - Has at least one message (extraction needs content)
    // - Either:
    //     - status === LEAD_CAPTURED (operator-attested OR auto-detected
    //       email/phone)
    //     - OR capturedEmail/capturedPhone is non-null
    // - lastMessageAt within the look-back window
    //
    // We INTENTIONALLY include conversations that already have
    // prospectProfileEmailedAt set — operator wants the rich digest
    // re-sent to the freshly-configured recipient. The send helper
    // is called with force=true which overrides the de-bounce.
    const eligible = await prisma.chatbotConversation.findMany({
      where: {
        orgId: scope.orgId,
        messageCount: { gt: 0 },
        lastMessageAt: { gte: since },
        OR: [
          { status: "LEAD_CAPTURED" },
          { capturedEmail: { not: null } },
          { capturedPhone: { not: null } },
        ],
      },
      select: { id: true },
      orderBy: { lastMessageAt: "desc" },
    });

    if (dryRun) {
      return {
        ok: true,
        candidateCount: eligible.length,
        sent: 0,
        skipped: 0,
        failed: 0,
        dryRun: true,
      };
    }

    if (eligible.length === 0) {
      return {
        ok: true,
        candidateCount: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        dryRun: false,
      };
    }

    // Dynamic import keeps this server-only helper out of the chatbot-
    // config bundle when this action isn't being called.
    const { sendProspectProfileForConversation } = await import(
      "@/lib/chatbot/send-prospect-profile"
    );

    // Concurrency 1 with NO artificial sleep — Anthropic's natural
    // 1-2 sec per extractProspectProfile call is already enough
    // spacing for Google Workspace's bulk filter. The previous
    // 1.5-sec setTimeout on top of the extract latency was pushing
    // each conversation to ~3.5 sec wall-clock; an 11-conversation
    // backfill hit the Vercel serverless ceiling before returning,
    // which surfaced as the "Backfill request failed before
    // returning" error in the panel. Adam caught this 2026-06-03.
    //
    // Serial sends + ~2 sec organic delay = 11 emails over ~22 sec.
    // That's still well under Google's per-recipient bulk threshold
    // (heuristic: 1 / 0.5-1 sec for warm senders).
    const CONCURRENCY = 1;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const reasons: string[] = [];
    // Wall-clock budget: 50 seconds. Vercel server actions cap at 60s
    // on Pro; reserving 10s of headroom for the post-loop revalidate +
    // audit row insert + response serialization. If we run out, we
    // return ok:true with whatever's been processed so far — the
    // operator can re-run to pick up the remainder.
    const BUDGET_MS = 50_000;
    const deadline = Date.now() + BUDGET_MS;
    let timedOut = false;

    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      if (Date.now() > deadline) {
        timedOut = true;
        const remaining = eligible.length - i;
        reasons.push(
          `timed out: ${remaining} conversation${remaining === 1 ? "" : "s"} not processed — re-run the backfill`,
        );
        skipped += remaining;
        break;
      }
      const slice = eligible.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        slice.map((row) =>
          sendProspectProfileForConversation({
            conversationId: row.id,
            force: true,
            reason: "backfill",
          }),
        ),
      );
      for (const r of results) {
        if (r.status !== "fulfilled") {
          failed += 1;
          reasons.push(
            `rejected: ${r.reason instanceof Error ? r.reason.message : String(r.reason).slice(0, 200)}`,
          );
          continue;
        }
        const v = r.value;
        if (v.ok && v.sent) {
          sent += 1;
          reasons.push("sent");
        } else if (v.ok && !v.sent) {
          skipped += 1;
          reasons.push(`skipped: ${v.skipped}`);
        } else {
          failed += 1;
          reasons.push(
            `failed: ${"error" in v ? v.error : "unknown"}`,
          );
        }
      }
    }

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: scope.orgId,
        description: `Backfilled chatbot lead emails — ${sent} sent, ${skipped} skipped, ${failed} failed (last ${days} days)`,
      }),
    });

    revalidatePath("/portal/chatbot");
    return {
      ok: true,
      candidateCount: eligible.length,
      sent,
      skipped,
      failed,
      dryRun: false,
      reasons,
    };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("backfillChatbotLeadEmails failed", err);
    return { ok: false, error: "Backfill failed" };
  }
}

export async function toggleChatbotEnabled(
  enabled: boolean
): Promise<ActionResult> {
  try {
    const scope = await requireScope();

    const org = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { moduleChatbot: true },
    });
    if (!org) return { ok: false, error: "Organization not found" };
    if (enabled && !org.moduleChatbot) {
      return {
        ok: false,
        error: "Chatbot module isn't active on your plan.",
      };
    }

    const config = await prisma.tenantSiteConfig.upsert({
      where: { orgId: scope.orgId },
      update: { chatbotEnabled: enabled },
      create: {
        orgId: scope.orgId,
        chatbotEnabled: enabled,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "TenantSiteConfig",
        entityId: config.id,
        description: `Chatbot ${enabled ? "enabled" : "disabled"}`,
        diff: { chatbotEnabled: enabled } as Prisma.InputJsonValue,
      }),
    });

    revalidatePath("/portal/chatbot");
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("toggleChatbotEnabled failed", err);
    return { ok: false, error: "Failed to update chatbot status" };
  }
}
