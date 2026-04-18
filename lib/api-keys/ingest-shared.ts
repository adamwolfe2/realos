import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey, requireScope } from "./auth";
import {
  publicApiLimiter,
  checkRateLimit,
} from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Shared guard for every /api/ingest/* route. Authenticates the bearer token,
// enforces the required scope, and rate-limits per-key (so a single customer
// can't flood their own tenant and we don't penalise shared IPs).
//
// Returns either the authenticated context or a ready-to-return NextResponse
// describing the failure. Route handlers just:
//
//   const gate = await guardIngest(req, "ingest:lead");
//   if (!gate.ok) return gate.response;
//   const { orgId } = gate;
// ---------------------------------------------------------------------------

type GuardResult =
  | {
      ok: true;
      orgId: string;
      keyId: string;
      keyHash: string;
      scopes: string[];
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function guardIngest(
  req: NextRequest,
  requiredScope: string
): Promise<GuardResult> {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or missing API key" },
        { status: 401 }
      ),
    };
  }

  if (!requireScope(auth.scopes, requiredScope)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "API key missing required scope",
          required: requiredScope,
        },
        { status: 403 }
      ),
    };
  }

  const { allowed, limit, remaining, reset } = await checkRateLimit(
    publicApiLimiter,
    `apikey:${auth.keyHash}`
  );
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      ),
    };
  }

  return {
    ok: true,
    orgId: auth.orgId,
    keyId: auth.keyId,
    keyHash: auth.keyHash,
    scopes: auth.scopes,
  };
}
