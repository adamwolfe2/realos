import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { maybeEncrypt } from "@/lib/crypto";
import { AuditAction, BackendPlatform } from "@prisma/client";

// Hostname-label regex. The value flows into outbound URLs as
// `https://${instanceSubdomain}.appfolio.com/...` — without this gate
// a fragment / colon / slash in the value lets the URL parser
// re-anchor to a different host. Same SSRF posture as the /test
// probe.
const subdomainSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Subdomain must be lowercase letters, digits, or hyphens (no dots)",
  );

const patch = z.object({
  instanceSubdomain: subdomainSchema.optional(),
  propertyGroupFilter: z.string().max(200).optional().nullable(),
  apiKey: z.string().min(4).max(500).optional(),
  useEmbedFallback: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncFrequencyMinutes: z.number().int().min(15).max(1440).optional(),
});

export async function GET() {
  try {
    const scope = await requireScope();
    // findUnique() WITHOUT a select fetches every column — including any
    // that may not yet exist in the production DB. Wrap in try/catch and
    // fall back to a minimal column set so the poller doesn't 500 just
    // because schema drift is in flight. The 20260504_appfolio_sync_columns
    // migration brings every prod DB up to spec, but we still want this
    // route to work during the deploy window.
    let integration: Awaited<
      ReturnType<typeof prisma.appFolioIntegration.findUnique>
    > | null = null;
    try {
      integration = await prisma.appFolioIntegration.findUnique({
        where: { orgId: scope.orgId },
      });
    } catch (err) {
      console.warn(
        "[appfolio GET] full row read failed, falling back:",
        err instanceof Error ? err.message : err,
      );
      const minimal = await prisma.appFolioIntegration
        .findUnique({
          where: { orgId: scope.orgId },
          select: {
            id: true,
            instanceSubdomain: true,
            propertyGroupFilter: true,
            useEmbedFallback: true,
            autoSyncEnabled: true,
            syncFrequencyMinutes: true,
            apiKeyEncrypted: true,
            lastSyncAt: true,
          },
        })
        .catch(() => null);
      if (minimal) {
        integration = {
          ...minimal,
          clientIdEncrypted: null,
          clientSecretEncrypted: null,
          oauthTokenEncrypted: null,
          oauthRefreshEncrypted: null,
          oauthExpiresAt: null,
          plan: null,
          embedScriptConfig: null,
          syncStartedAt: null,
          syncStatus: null,
          lastError: null,
          lastSyncStats: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          orgId: scope.orgId,
        } as typeof integration;
      }
    }
    if (!integration) return NextResponse.json({ integration: null });

    // Stuck-sync detection. If the row says "syncing" but syncStartedAt
    // is older than 10 minutes, the underlying sync function has
    // certainly been killed by Vercel's maxDuration. Surface as
    // "stuck" so the poller can render a Clear button instead of
    // polling forever on a wedged row.
    const STUCK_AFTER_MS = 10 * 60 * 1000;
    const isStuck =
      integration.syncStatus === "syncing" &&
      integration.syncStartedAt != null &&
      Date.now() - integration.syncStartedAt.getTime() > STUCK_AFTER_MS;

    return NextResponse.json({
      integration: {
        id: integration.id,
        instanceSubdomain: integration.instanceSubdomain,
        propertyGroupFilter: integration.propertyGroupFilter,
        useEmbedFallback: integration.useEmbedFallback,
        autoSyncEnabled: integration.autoSyncEnabled,
        syncFrequencyMinutes: integration.syncFrequencyMinutes,
        hasApiKey: !!integration.apiKeyEncrypted,
        lastSyncAt: integration.lastSyncAt,
        // Effective syncStatus: surfaces "stuck" when the row is
        // syncing-but-wedged so the client can render the right UI
        // without computing the threshold itself.
        syncStatus: isStuck ? "stuck" : integration.syncStatus,
        syncStartedAt: integration.syncStartedAt,
        lastError: integration.lastError,
        lastSyncStats: integration.lastSyncStats ?? null,
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const scope = await requireWritableWorkspace();
    const parsed = patch.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Detect credential changes that warrant resetting skipped-phase state.
    // When an operator upgrades their AppFolio plan or rotates credentials,
    // phases previously marked "unsupported" (permanent 404 / plan limitation)
    // must be re-evaluated — the new plan may expose those reports. We detect
    // this by checking whether any credential field is being updated.
    // Simplest safe signal: if apiKey or instanceSubdomain is being changed,
    // clear phaseFailures from lastSyncStats so the next sync re-attempts all
    // phases. This avoids a separate migration or credential-hash comparison.
    const credentialsChanging =
      d.instanceSubdomain !== undefined || d.apiKey !== undefined;

    const data: Record<string, unknown> = {
      instanceSubdomain:
        d.instanceSubdomain !== undefined ? d.instanceSubdomain : undefined,
      propertyGroupFilter:
        d.propertyGroupFilter !== undefined
          ? d.propertyGroupFilter ?? null
          : undefined,
      useEmbedFallback: d.useEmbedFallback,
      autoSyncEnabled: d.autoSyncEnabled,
      syncFrequencyMinutes: d.syncFrequencyMinutes,
      apiKeyEncrypted:
        d.apiKey !== undefined ? maybeEncrypt(d.apiKey) : undefined,
    };

    // Credential change: strip phaseFailures (and derived phaseWarnings) from
    // the persisted stats so the next sync re-evaluates all phases against the
    // new plan. Leaves all other stats intact (counts, completedAt, etc.) so
    // the operator's dashboard doesn't blank out during the transition.
    if (credentialsChanging) {
      const existing = await prisma.appFolioIntegration.findUnique({
        where: { orgId: scope.orgId },
        select: { lastSyncStats: true },
      });
      if (existing?.lastSyncStats && typeof existing.lastSyncStats === "object") {
        const { phaseFailures: _pf, phaseWarnings: _pw, ...rest } =
          existing.lastSyncStats as Record<string, unknown>;
        data.lastSyncStats = rest;
      }
    }

    // Ensure we have a stub row to upsert against.
    const integration = await prisma.appFolioIntegration.upsert({
      where: { orgId: scope.orgId },
      update: data,
      create: {
        orgId: scope.orgId,
        instanceSubdomain: d.instanceSubdomain ?? "",
        propertyGroupFilter: d.propertyGroupFilter ?? null,
        useEmbedFallback: d.useEmbedFallback ?? true,
        autoSyncEnabled: d.autoSyncEnabled ?? true,
        syncFrequencyMinutes: d.syncFrequencyMinutes ?? 60,
        apiKeyEncrypted:
          d.apiKey !== undefined ? maybeEncrypt(d.apiKey) : null,
      },
    });

    // Mark every Property on this org as AppFolio-backed if the tenant
    // explicitly set this integration.
    await prisma.property.updateMany({
      where: { orgId: scope.orgId, backendPlatform: BackendPlatform.NONE },
      data: { backendPlatform: BackendPlatform.APPFOLIO },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.SETTING_CHANGE,
        entityType: "AppFolioIntegration",
        entityId: integration.id,
        description: "AppFolio integration settings updated",
      }),
    });

    return NextResponse.json({
      ok: true,
      integration: {
        id: integration.id,
        instanceSubdomain: integration.instanceSubdomain,
        propertyGroupFilter: integration.propertyGroupFilter,
        useEmbedFallback: integration.useEmbedFallback,
        autoSyncEnabled: integration.autoSyncEnabled,
        syncFrequencyMinutes: integration.syncFrequencyMinutes,
        hasApiKey: !!integration.apiKeyEncrypted,
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
