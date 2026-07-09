"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWritableWorkspace, auditPayload } from "@/lib/tenancy/scope";
import { encryptFunnelApiKey } from "@/lib/integrations/funnel-client";
import { AuditAction } from "@prisma/client";

// ---------------------------------------------------------------------------
// Funnel Leasing connect / disconnect server actions.
//
// Stores the operator-supplied Funnel Customer API credentials + config on a
// per-org FunnelIntegration row. The API key is envelope-encrypted (per-org
// AES-256-GCM via lib/vault/crypto) before it ever touches the DB. Everything
// here is operator-supplied — we NEVER hardcode a host, group, or discovery
// source. The integration ships disabled; the operator flips "enabled" on when
// they've confirmed the base URL + group id with Funnel/their account.
// ---------------------------------------------------------------------------

const PORTAL_PATH = "/portal/settings/integrations";
const PORTAL_HOME = "/portal";

// Sentinel the form submits when the operator leaves the (write-only) key field
// untouched on an existing connection — means "keep the stored key".
const KEEP_EXISTING_KEY = "__KEEP__";

const connectSchema = z.object({
  apiKey: z.string().trim().max(500).optional(),
  apiBaseUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v.replace(/\/+$/, "") : v))
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Base URL must start with http:// or https://",
    }),
  groupId: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), {
      message: "Group id must be a whole number",
    }),
  discoverySourceId: z.string().trim().max(200).optional(),
  enabled: z.boolean(),
});

export type ConnectFunnelResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: string };

export async function connectFunnel(
  formData: FormData,
): Promise<ConnectFunnelResult> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const parsed = connectSchema.safeParse({
    apiKey: formData.get("apiKey")?.toString() || undefined,
    apiBaseUrl: formData.get("apiBaseUrl")?.toString() || undefined,
    groupId: formData.get("groupId")?.toString() || undefined,
    discoverySourceId: formData.get("discoverySourceId")?.toString() || undefined,
    enabled: formData.get("enabled")?.toString() === "on",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: first };
  }

  const { apiKey, apiBaseUrl, groupId, discoverySourceId, enabled } = parsed.data;

  try {
    const existing = await prisma.funnelIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: { id: true, apiKeyEncrypted: true },
    });

    // Resolve the key to persist:
    //   - a fresh non-sentinel value → encrypt + store
    //   - the sentinel (untouched field) → keep the existing encrypted key
    //   - empty on a new row → store nothing (stays disconnected)
    let apiKeyEncrypted: string | null | undefined;
    if (apiKey && apiKey !== KEEP_EXISTING_KEY) {
      apiKeyEncrypted = await encryptFunnelApiKey(scope.orgId, apiKey);
    } else if (apiKey === KEEP_EXISTING_KEY) {
      apiKeyEncrypted = existing?.apiKeyEncrypted ?? null;
    } else {
      apiKeyEncrypted = null;
    }

    // Guard: never let the operator flip "enabled" on without the three fields
    // a push actually needs. Prevents a green "connected" state that silently
    // no-ops on every lead.
    if (enabled && (!apiKeyEncrypted || !apiBaseUrl || !groupId)) {
      return {
        ok: false,
        error:
          "To enable, provide the API key, API base URL, and group id. Confirm the base URL with Funnel support if unsure.",
      };
    }

    const data = {
      apiKeyEncrypted,
      apiBaseUrl: apiBaseUrl ?? null,
      groupId: groupId ? Number(groupId) : null,
      discoverySourceId: discoverySourceId ?? null,
      enabled,
      lastError: null as string | null,
    };

    // create/update (not upsert) — the Neon HTTP adapter doesn't support the
    // implicit transaction Prisma generates for upsert (same reason as
    // appfolio-connect).
    const integration = existing
      ? await prisma.funnelIntegration.update({
          where: { orgId: scope.orgId },
          data,
        })
      : await prisma.funnelIntegration.create({
          data: { orgId: scope.orgId, ...data },
        });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.SETTING_CHANGE,
        entityType: "FunnelIntegration",
        entityId: integration.id,
        description: existing
          ? `Funnel Leasing updated (${enabled ? "enabled" : "disabled"})`
          : `Funnel Leasing connected (${enabled ? "enabled" : "disabled"})`,
      }),
    });

    revalidatePath(PORTAL_PATH);
    revalidatePath(PORTAL_HOME);
    return { ok: true, enabled };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[funnel-connect] save error", err);
    return { ok: false, error: message };
  }
}

export async function disconnectFunnel(): Promise<ConnectFunnelResult> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const existing = await prisma.funnelIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { id: true },
  });
  if (!existing) return { ok: true, enabled: false };

  await prisma.funnelIntegration.update({
    where: { orgId: scope.orgId },
    data: {
      apiKeyEncrypted: null,
      apiBaseUrl: null,
      groupId: null,
      discoverySourceId: null,
      enabled: false,
      lastError: null,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "FunnelIntegration",
      entityId: existing.id,
      description: "Funnel Leasing disconnected",
    }),
  });

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);
  return { ok: true, enabled: false };
}
