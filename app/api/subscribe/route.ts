import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pushContact, isConfigured } from "@/lib/integrations/emailbison";
import { publicSignupLimiter, checkRateLimit, getIp } from "@/lib/rate-limit";

// Platform-level subscriber signups (landing pages, content upgrades).
// EmailSubscriber is unique on (orgId, email); platform signups have orgId=null.
export async function POST(req: NextRequest) {
  const { allowed } = await checkRateLimit(publicSignupLimiter, getIp(req));
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const source = body.source ?? "platform";

  try {
    const existing = await prisma.emailSubscriber.findFirst({
      where: { email, orgId: null },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ ok: true, already: true });
    }

    if (isConfigured()) {
      try {
        await pushContact({
          email,
          first_name: email.split("@")[0],
          description: `Platform subscriber (source: ${source})`,
        });
      } catch {
        // Non-fatal
      }
    }

    await prisma.emailSubscriber.create({
      data: { email, source },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/subscribe]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
