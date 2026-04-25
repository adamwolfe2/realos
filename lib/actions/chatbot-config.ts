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
      chatbotTeaserText: firstString(formData.get("chatbotTeaserText")),
      chatbotBrandColor: firstString(formData.get("chatbotBrandColor")),
      chatbotIdleTriggerSeconds: firstString(
        formData.get("chatbotIdleTriggerSeconds")
      ),
      chatbotCaptureMode: firstString(formData.get("chatbotCaptureMode")),
      chatbotKnowledgeBase: firstString(formData.get("chatbotKnowledgeBase")),
      ga4MeasurementId: firstString(formData.get("ga4MeasurementId")),
    };

    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        ok: false,
        error: first?.message ?? "Validation failed",
      };
    }

    // Billing gate — refuse to flip the master toggle on when the module
    // isn't active on this plan. We still let operators edit the rest of
    // the fields so they can stage content before billing activates.
    const data = {
      ...parsed.data,
      chatbotEnabled: org.moduleChatbot ? parsed.data.chatbotEnabled : false,
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
