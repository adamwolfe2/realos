import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere, ForbiddenError } from "@/lib/tenancy/scope";
import { buildIcs } from "@/lib/calendar/ics";
import { BRAND_NAME } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tenant/tours/[id]/ics
// Returns a Content-Type: text/calendar payload for the requested Tour.
// The leasing agent (or the lead, if shared) can save it to Google Calendar
// / Apple Calendar / Outlook in one click. Tenant-scoped; tours from other
// orgs 404.

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await ctx.params;

  const tour = await prisma.tour.findFirst({
    where: { id, lead: tenantWhere(scope) },
    select: {
      id: true,
      scheduledAt: true,
      tourType: true,
      attendeeCount: true,
      notes: true,
      lead: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      property: {
        select: {
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
        },
      },
    },
  });

  if (!tour) {
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });
  }

  const start = tour.scheduledAt ?? new Date();
  // Default tour duration: 30 minutes
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const attendeeName = [tour.lead.firstName, tour.lead.lastName]
    .filter(Boolean)
    .join(" ") || tour.lead.email || "Lead";
  const propertyName = tour.property?.name ?? "Property tour";
  const address = [
    tour.property?.addressLine1,
    tour.property?.addressLine2,
    [tour.property?.city, tour.property?.state, tour.property?.postalCode]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  const description = [
    `Property tour for ${attendeeName} at ${propertyName}.`,
    tour.tourType ? `Type: ${tour.tourType.replace(/_/g, " ")}` : null,
    tour.attendeeCount ? `Attendees: ${tour.attendeeCount}` : null,
    tour.lead.email ? `Lead email: ${tour.lead.email}` : null,
    tour.lead.phone ? `Lead phone: ${tour.lead.phone}` : null,
    tour.notes ? `Notes: ${tour.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const ics = buildIcs([
    {
      uid: `tour-${tour.id}@leasestack`,
      start,
      end,
      summary: `Tour: ${propertyName} — ${attendeeName}`,
      description,
      location: address || undefined,
      organizerName: BRAND_NAME,
      attendeeName,
      attendeeEmail: tour.lead.email,
    },
  ]);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="tour-${tour.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
