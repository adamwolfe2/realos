"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { encrypt } from "@/lib/crypto";
import { probeEmbedScrape } from "@/lib/integrations/appfolio";
import {
  runAppfolioSync,
  type AppfolioSyncStats,
} from "@/lib/integrations/appfolio-sync";
import { AuditAction, BackendPlatform } from "@prisma/client";

// ---------------------------------------------------------------------------
// AppFolio connect / disconnect / manual-sync server actions.
//
// AppFolio supports two paths for operators:
//   1. EMBED mode (default for Core-plan tenants): no credentials required,
//      we scrape the public listings page at
//      https://{subdomain}.appfolio.com/listings with cheerio. Optional
//      address filter matches listings to a specific property when the
//      tenant operates multiple properties under one AppFolio account.
//   2. REST mode (Plus/Max tenants with a Developer Portal contract):
//      clientId + clientSecret, authenticated via HTTP Basic against the
//      reports endpoint.
//
// AppFolio does NOT issue a single-string API key separate from the
// Developer Portal clientId/clientSecret pair. Embed is the only path that
// works for operators on Core.
// ---------------------------------------------------------------------------

const PORTAL_PATH = "/portal/settings/integrations";
const PORTAL_HOME = "/portal";

const subdomainRegex = /^[a-z0-9][a-z0-9-]*$/;

function normalizeSubdomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.appfolio\.com.*$/i, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9-]/g, "");
}

const connectSchema = z.discriminatedUnion("authMode", [
  z.object({
    authMode: z.literal("embed"),
    subdomain: z
      .string()
      .trim()
      .min(1, "Subdomain is required")
      .max(200)
      .transform(normalizeSubdomain)
      .refine((v) => subdomainRegex.test(v), {
        message:
          "Subdomain must be the slug before .appfolio.com — letters, numbers, and hyphens only.",
      }),
    addressFilter: z.string().trim().max(500).optional(),
  }),
  z.object({
    authMode: z.literal("rest"),
    subdomain: z
      .string()
      .trim()
      .min(1, "Subdomain is required")
      .max(200)
      .transform(normalizeSubdomain)
      .refine((v) => subdomainRegex.test(v), {
        message:
          "Subdomain must be the slug before .appfolio.com — letters, numbers, and hyphens only.",
      }),
    clientId: z.string().trim().min(4, "Client ID is required").max(500),
    clientSecret: z.string().trim().min(4, "Client secret is required").max(500),
  }),
]);

export type ConnectAppfolioResult =
  | { ok: true; mode: "embed" | "rest"; listingsFound?: number }
  | { ok: false; error: string };

export type SyncAppfolioResult =
  | { ok: true; stats: AppfolioSyncStats }
  | { ok: false; error: string; stats?: AppfolioSyncStats };

export async function connectAppfolio(
  formData: FormData
): Promise<ConnectAppfolioResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const authMode =
    (formData.get("authMode")?.toString() as "embed" | "rest") || "embed";

  const parsed = connectSchema.safeParse({
    authMode,
    subdomain: formData.get("subdomain")?.toString() ?? "",
    addressFilter: formData.get("addressFilter")?.toString() || undefined,
    clientId: formData.get("clientId")?.toString() ?? "",
    clientSecret: formData.get("clientSecret")?.toString() ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: first };
  }

  const { subdomain } = parsed.data;

  try {
  // Validate credentials before persisting. For embed mode, probe the
  // public listings page. For REST mode, the user must have already clicked
  // "Test connection" in the UI — we trust that gate and skip a second probe
  // here to avoid double-counting rate-limit hits and to keep save fast.
  let listingsFound: number | undefined;
  if (parsed.data.authMode === "embed") {
    const probe = await probeEmbedScrape(subdomain);
    if (!probe.ok) {
      return {
        ok: false,
        error: `Couldn't reach ${subdomain}.appfolio.com/listings — ${probe.error}`,
      };
    }
    listingsFound = probe.count;
  }

  const isEmbed = parsed.data.authMode === "embed";
  const clientIdEncrypted =
    parsed.data.authMode === "rest" ? encrypt(parsed.data.clientId) : null;
  const clientSecretEncrypted =
    parsed.data.authMode === "rest" ? encrypt(parsed.data.clientSecret) : null;
  const addressFilter =
    parsed.data.authMode === "embed"
      ? (parsed.data.addressFilter ?? null)
      : null;

  const existing = await prisma.appFolioIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { id: true },
  });

  // Use create/update instead of upsert — the Neon HTTP adapter does not
  // support the implicit transaction that Prisma generates for upsert.
  const integrationData = {
    instanceSubdomain: subdomain,
    apiKeyEncrypted: null as string | null,
    clientIdEncrypted,
    clientSecretEncrypted,
    useEmbedFallback: isEmbed,
    propertyGroupFilter: addressFilter,
    autoSyncEnabled: true,
    syncStatus: "idle",
    lastError: null as string | null,
  };

  const integration = existing
    ? await prisma.appFolioIntegration.update({
        where: { orgId: scope.orgId },
        data: integrationData,
      })
    : await prisma.appFolioIntegration.create({
        data: { orgId: scope.orgId, syncFrequencyMinutes: 60, ...integrationData },
      });

  await prisma.property.updateMany({
    where: {
      orgId: scope.orgId,
      backendPlatform: BackendPlatform.NONE,
    },
    data: { backendPlatform: BackendPlatform.APPFOLIO },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AppFolioIntegration",
      entityId: integration.id,
      description: existing
        ? `AppFolio reconnected (${isEmbed ? "embed" : "REST"} mode)`
        : `AppFolio connected (${isEmbed ? "embed" : "REST"} mode)`,
    }),
  });

  // Fire-and-forget initial backfill. The tile will reflect status on the
  // next page render.
  // Intentionally not awaited — sync runs in the background after save.
  // Wrapped in an IIFE so any thrown error (including Neon HTTP transaction
  // errors from upserts) never reaches the outer catch and breaks the save.
  void (async () => {
    try {
      await runAppfolioSync(scope.orgId, { fullBackfill: true });
    } catch (err) {
      console.warn("[appfolio-connect] initial sync error", err);
    }
  })();

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);
  return { ok: true, mode: isEmbed ? "embed" : "rest", listingsFound };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[appfolio-connect] save error", err);
    return { ok: false, error: message };
  }
}

export async function disconnectAppfolio(): Promise<ConnectAppfolioResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const existing = await prisma.appFolioIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { id: true },
  });
  if (!existing) return { ok: true, mode: "embed" };

  await prisma.appFolioIntegration.update({
    where: { orgId: scope.orgId },
    data: {
      clientIdEncrypted: null,
      clientSecretEncrypted: null,
      apiKeyEncrypted: null,
      oauthTokenEncrypted: null,
      oauthRefreshEncrypted: null,
      oauthExpiresAt: null,
      useEmbedFallback: false,
      autoSyncEnabled: false,
      syncStatus: "idle",
      lastError: null,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AppFolioIntegration",
      entityId: existing.id,
      description: "AppFolio disconnected",
    }),
  });

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);
  return { ok: true, mode: "embed" };
}

export async function triggerAppfolioSync(): Promise<SyncAppfolioResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const result = await runAppfolioSync(scope.orgId);

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Sync failed",
      stats: result.stats,
    };
  }
  return { ok: true, stats: result.stats };
}
