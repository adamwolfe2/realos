import { NextResponse } from "next/server";
import { getScope } from "@/lib/tenancy/scope";

// Smoke-test endpoint. Not exposed in the UI.
// Used in Sprint 02 verification to confirm impersonation flips orgId and
// that agency vs client scopes resolve correctly.
// TODO(v2): remove once the admin UI has a visible impersonation banner
// showing this state natively.
export async function GET() {
  const scope = await getScope();
  return NextResponse.json({ scope });
}
