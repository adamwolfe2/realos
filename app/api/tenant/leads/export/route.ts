import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, LeadStatus, LeadSource } from "@prisma/client";
import { buildCsv, csvFileResponse } from "@/lib/csv";

// GET /api/tenant/leads/export
//
// Streams the tenant's full Lead set as CSV, suitable for opening in Excel
// or importing into a CRM. Supports the same status / source / since filters
// as the leads list page.
export async function GET(req: Request) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const source = url.searchParams.get("source");
  const sinceDays = parseInt(url.searchParams.get("sinceDays") ?? "0", 10);

  const where: Record<string, unknown> = { ...tenantWhere(scope) };
  if (status && status in LeadStatus) where.status = status as LeadStatus;
  if (source && source in LeadSource) where.source = source as LeadSource;
  if (sinceDays > 0) {
    where.createdAt = {
      gte: new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000),
    };
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50_000,
    include: {
      property: { select: { name: true } },
    },
  });

  const header = [
    "id",
    "createdAt",
    "status",
    "source",
    "sourceDetail",
    "firstName",
    "lastName",
    "email",
    "phone",
    "property",
    "score",
    "desiredMoveIn",
    "lastActivityAt",
    "notes",
  ];
  const rows = leads.map((l) => [
    l.id,
    l.createdAt.toISOString(),
    l.status,
    l.source,
    l.sourceDetail,
    l.firstName,
    l.lastName,
    l.email,
    l.phone,
    l.property?.name ?? "",
    l.score,
    l.desiredMoveIn?.toISOString() ?? "",
    l.lastActivityAt?.toISOString() ?? "",
    l.notes,
  ]);

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.EXPORT,
      entityType: "Lead",
      description: `Exported ${leads.length} leads to CSV`,
      diff: { count: leads.length, status, source, sinceDays },
    }),
  });

  const filename = `leads-${scope.orgId}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvFileResponse(buildCsv(header, rows), filename);
}
