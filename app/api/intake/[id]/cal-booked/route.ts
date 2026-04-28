import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { notifyNewIntake } from "@/lib/integrations/slack";

// Cal.com booking webhook. Flips IntakeSubmission.bookedCallAt when a
// consultation is booked.
// DECISION: The schema stores the booked timestamp + Cal.com booking id, not
// the legacy boolean calBooked flag.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^c[a-z0-9]{24,}$/.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const sig = req.headers.get("X-Cal-Signature-256") ?? "";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { bookingId?: string; startTime?: string } = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    // body may be empty on some cal.com webhook events; keep going
  }

  try {
    const intake = await prisma.intakeSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        bookedCallAt: true,
        companyName: true,
        primaryContactName: true,
        primaryContactEmail: true,
        propertyType: true,
      },
    });

    if (!intake) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!intake.bookedCallAt) {
      await prisma.intakeSubmission.update({
        where: { id },
        data: {
          bookedCallAt: body.startTime ? new Date(body.startTime) : new Date(),
          calBookingId: body.bookingId ?? null,
          status: "consultation_booked",
        },
      });

      // Fire-and-forget Slack ping so ops sees the booking land in real time.
      // Reuses the new-intake template since the existing block layout
      // already covers the fields we have here.
      void notifyNewIntake({
        companyName: `${intake.companyName} (call booked)`,
        contactName: intake.primaryContactName,
        contactEmail: intake.primaryContactEmail,
        propertyType: intake.propertyType,
        intakeId: intake.id,
      }).catch((err) => {
        console.warn("[cal-booked] slack notify failed:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/intake/[id]/cal-booked]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
