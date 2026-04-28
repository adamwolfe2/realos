import "server-only";
import type { NextRequest } from "next/server";
import { resolveTenantByHostname } from "./resolve";

// ---------------------------------------------------------------------------
// Origin guard for public lead/tour/chatbot endpoints.
//
// Public APIs accept an `orgId` from the request body. Without verification,
// any visitor on any tenant's site can read another tenant's `orgId` (it
// leaks via /api/public/chatbot/config) and forge leads / tours / chats
// against that competitor — polluting their pipeline and amplifying email
// to their contacts via our Resend account.
//
// This guard requires the request's `Origin` (or `Referer`) hostname to
// resolve to the same orgId the body claims. Hostname → orgId resolution
// reuses the same logic the middleware uses for tenant-site rendering, so
// custom domains and `<slug>.leasestack.co` subdomains both work.
//
// Failures are intentionally generic ("Origin not authorized for this
// tenant") to avoid leaking which orgIds exist.
// ---------------------------------------------------------------------------

export type OriginGuardOk = { ok: true; hostname: string };
export type OriginGuardFail = { ok: false; status: number; error: string };

export async function requireMatchingOrigin(
  req: NextRequest,
  claimedOrgId: string,
): Promise<OriginGuardOk | OriginGuardFail> {
  const hostname = hostnameFromRequest(req);
  if (!hostname) {
    return {
      ok: false,
      status: 403,
      error: "Missing Origin",
    };
  }

  let tenant: Awaited<ReturnType<typeof resolveTenantByHostname>>;
  try {
    tenant = await resolveTenantByHostname(hostname);
  } catch {
    return {
      ok: false,
      status: 403,
      error: "Origin not authorized for this tenant",
    };
  }

  if (!tenant || tenant.orgId !== claimedOrgId) {
    return {
      ok: false,
      status: 403,
      error: "Origin not authorized for this tenant",
    };
  }

  return { ok: true, hostname };
}

function hostnameFromRequest(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (origin) {
    const h = parseHost(origin);
    if (h) return h;
  }
  const referer = req.headers.get("referer");
  if (referer) {
    const h = parseHost(referer);
    if (h) return h;
  }
  return null;
}

function parseHost(input: string): string | null {
  try {
    const url = new URL(input);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}
