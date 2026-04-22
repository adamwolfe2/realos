import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { encrypt } from "@/lib/crypto";
import {
  testAppFolioConnection,
  probeEmbedScrape,
} from "@/lib/integrations/appfolio";

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("embed"),
    subdomain: z.string().min(1).max(200),
  }),
  z.object({
    mode: z.literal("rest"),
    subdomain: z.string().min(1).max(200),
    clientId: z.string().min(1).max(500),
    clientSecret: z.string().min(1).max(500),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const scope = await requireScope();
    void scope; // auth check only — no org-specific data needed for a probe

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { mode, subdomain } = parsed.data;

    if (mode === "embed") {
      const result = await probeEmbedScrape(subdomain);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error });
      }
      return NextResponse.json({ ok: true, listingsFound: result.count });
    }

    // REST mode — build a transient integration object (not persisted) and
    // call the existing testAppFolioConnection helper.
    const stub = {
      id: "probe",
      orgId: scope.orgId,
      instanceSubdomain: subdomain,
      plan: null,
      apiKeyEncrypted: null,
      clientIdEncrypted: encrypt(parsed.data.clientId),
      clientSecretEncrypted: encrypt(parsed.data.clientSecret),
      oauthTokenEncrypted: null,
      oauthRefreshEncrypted: null,
      oauthExpiresAt: null,
      lastSyncAt: null,
      syncStatus: null,
      lastError: null,
      propertyGroupFilter: null,
      syncFrequencyMinutes: 60,
      autoSyncEnabled: true,
      useEmbedFallback: false,
      embedScriptConfig: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Parameters<typeof testAppFolioConnection>[0];

    const result = await testAppFolioConnection(stub);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
