import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { maybeEncrypt } from "@/lib/crypto";
import { AuditAction, BackendPlatform } from "@prisma/client";

const patch = z.object({
  instanceSubdomain: z.string().min(1).max(200).optional(),
  propertyGroupFilter: z.string().max(200).optional().nullable(),
  apiKey: z.string().min(4).max(500).optional(),
  useEmbedFallback: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncFrequencyMinutes: z.number().int().min(15).max(1440).optional(),
});

export async function GET() {
  try {
    const scope = await requireScope();
    const integration = await prisma.appFolioIntegration.findUnique({
      where: { orgId: scope.orgId },
    });
    if (!integration) return NextResponse.json({ integration: null });
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
        syncStatus: integration.syncStatus,
        lastError: integration.lastError,
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
    const scope = await requireScope();
    const parsed = patch.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const data = {
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
