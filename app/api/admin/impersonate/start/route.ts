import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startImpersonation } from "@/lib/tenancy/impersonate";
import { ForbiddenError } from "@/lib/tenancy/scope";

const body = z.object({
  orgId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", details: err.issues },
        { status: 400 }
      );
    }
    throw err;
  }

  try {
    const result = await startImpersonation(parsed.orgId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
