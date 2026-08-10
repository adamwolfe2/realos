import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAttributionProof } from "@/lib/attribution/proof";
import {
  parseAttributionDateRange,
  parseAttributionSource,
} from "@/lib/attribution/proof-filters";
import { buildCsv, csvFileResponse } from "@/lib/csv";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import {
  auditPayload,
  ForbiddenError,
  requireScope,
} from "@/lib/tenancy/scope";

export async function GET(request: Request) {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const url = new URL(request.url);
  const range = parseAttributionDateRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  const source = parseAttributionSource(url.searchParams.get("source"));
  const requestedIds = await parsePropertyFilter(
    {
      properties: url.searchParams.get("properties") ?? undefined,
      property: url.searchParams.get("property") ?? undefined,
    },
    scope.orgId,
  );

  const [organization, allProperties] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { moduleAttribution: true },
    }),
    prisma.property.findMany({
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true },
    }),
  ]);
  if (!organization?.moduleAttribution) {
    return NextResponse.json(
      { error: "Attribution module is not active" },
      { status: 403 },
    );
  }

  const properties = visibleProperties(scope, allProperties);
  const tenantValid = (requestedIds ?? []).filter((id) =>
    properties.some((property) => property.id === id),
  );
  const gatedIds = effectivePropertyIds(
    scope,
    tenantValid.length > 0 ? tenantValid : requestedIds ? [] : null,
  );
  const propertyIds = gatedIds ?? properties.map((property) => property.id);
  const proof = await getAttributionProof({
    orgId: scope.orgId,
    propertyIds,
    includeOrgLevel: gatedIds === null,
    fromDate: range.fromDate,
    toDate: range.toDate,
    source,
  });

  const header = [
    "leadId",
    "lead",
    "email",
    "phone",
    "property",
    "source",
    "sourceProof",
    "firstTouchAt",
    "capturedAt",
    "stage",
    "verification",
    "pmsEvidence",
    "matchMethod",
    "matchConfidence",
  ];
  const rows = proof.rows.map((row) => [
    row.id,
    row.name,
    row.email,
    row.phone,
    row.propertyName,
    row.sourceLabel,
    row.provenance,
    row.firstTouchAt.toISOString(),
    row.capturedAt.toISOString(),
    row.stage,
    row.verification,
    row.outcomeEvidence,
    row.matchMethod,
    row.matchConfidence,
  ]);

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.EXPORT,
      entityType: "AttributionProof",
      description: `Exported ${rows.length} lead attribution proof rows`,
      diff: {
        count: rows.length,
        from: range.fromIso,
        to: range.toIso,
        source,
        propertyIds: [...propertyIds],
      },
    }),
  });

  return csvFileResponse(
    buildCsv(header, rows),
    `lead-to-lease-proof-${range.fromIso}-to-${range.toIso}.csv`,
  );
}
