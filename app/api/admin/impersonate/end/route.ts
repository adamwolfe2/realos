import { NextResponse } from "next/server";
import { endImpersonation } from "@/lib/tenancy/impersonate";
import { ForbiddenError } from "@/lib/tenancy/scope";

export async function POST() {
  try {
    await endImpersonation();
    return NextResponse.redirect(
      new URL(
        "/admin",
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      ),
      { status: 303 }
    );
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
