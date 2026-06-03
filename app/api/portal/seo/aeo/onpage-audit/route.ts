import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireScope,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import { runOnPageAudit } from "@/lib/aeo/run-onpage-audit";
import {
  orgHasActiveAddon,
  ADDON_AEO_BOOST,
} from "@/lib/proposals/org-addons";

// ---------------------------------------------------------------------------
// POST /api/portal/seo/aeo/onpage-audit
//
// Gated AEO OnPage audit. Available only to orgs with the AEO Boost
// $199/mo add-on. Returns the per-check breakdown + 0-100 score.
//
// Body: { url: string }
//
// Auth: requireScope() — caller must belong to the tenant org.
// Gate:  orgHasActiveAddon(orgId, ADDON_AEO_BOOST) — 402 otherwise so the
//        client can show an upgrade hook.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  url: z
    .string()
    .min(3, "URL is too short")
    .max(500, "URL is too long"),
  propertyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  // Addon gate. Surfaces 402 Payment Required so the client UI knows to
  // render the "Upgrade" hook rather than a generic auth error.
  const hasAddon = await orgHasActiveAddon(scope.orgId, ADDON_AEO_BOOST);
  if (!hasAddon) {
    return NextResponse.json(
      {
        error:
          "AEO OnPage audit requires the AEO Boost add-on. Add it to your subscription to unlock per-page audits.",
        upgradeUrl: "/portal/billing",
      },
      { status: 402 },
    );
  }

  const result = await runOnPageAudit({
    orgId: scope.orgId,
    url: parsed.data.url,
    propertyId: parsed.data.propertyId ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    auditRowId: result.auditRowId,
    source: result.source,
    score: result.audit.score,
    checks: result.audit.checks,
    excerpt: result.audit.excerpt,
  });
}
