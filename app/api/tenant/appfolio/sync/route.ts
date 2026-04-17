import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";

export async function POST() {
  try {
    const scope = await requireScope();
    const result = await syncListingsForOrg(scope.orgId);
    return NextResponse.json(result, {
      status: result.error ? 409 : 200,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
