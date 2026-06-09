import { prisma } from "@/lib/db";
import { ApplicationStatus, ApplicantRole, type Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Applications data layer.
//
// Mirrors AppFolio's native "Rental Applications" screen: applications grouped
// by property -> unit, with co-applicants / co-signers collapsed into a single
// household application group under each unit.
//
// SCOPING INVARIANT: every query in this module MUST receive a tenant `where`
// (from `tenantWhere(scope)` against the Lead relation) and the property
// clause (from `propertyWhereFragment`). Callers in the portal build those
// from `requireScope()`; this module never widens scope.
// ---------------------------------------------------------------------------

export type ApplicantCard = {
  applicationId: string;
  leadId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: ApplicationStatus;
  role: ApplicantRole;
  isPrimary: boolean;
  desiredMoveIn: Date | null;
  receivedAt: Date | null;
  appliedAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
  screeningStatus: string | null;
};

export type ApplicationGroup = {
  groupId: string;
  primaryName: string;
  status: ApplicationStatus; // rollup: primary applicant's status
  receivedAt: Date | null; // latest received in the group, for sort
  applicants: ApplicantCard[];
};

export type UnitGroup = {
  unitKey: string;
  unitName: string; // human label, "Unassigned unit" when AppFolio gave none
  propertyId: string;
  propertyName: string;
  applicantCount: number;
  receivedAt: Date | null; // latest received in the unit, for sort
  groups: ApplicationGroup[];
};

const NO_UNIT = "__no_unit__";

function displayName(lead: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    "Anonymous applicant"
  );
}

function laterOf(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

// Sort: PRIMARY first, then by received date (oldest first within a group so
// the lead applicant reads at the top — matching AppFolio's row order).
function applicantSort(a: ApplicantCard, b: ApplicantCard): number {
  if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
  const at = a.receivedAt?.getTime() ?? a.createdAt.getTime();
  const bt = b.receivedAt?.getTime() ?? b.createdAt.getTime();
  return at - bt;
}

/**
 * Applications grouped by unit, then by household application group.
 *
 * @param leadWhere   tenant scope applied to the Lead relation (tenantWhere)
 * @param propertyClause property-access clause (propertyWhereFragment) — may be {}
 * @param sinceDays   look-back window (default 120d covers an open leasing season)
 */
export async function getApplicationsByUnit(
  leadWhere: Prisma.LeadWhereInput,
  propertyClause: Prisma.ApplicationWhereInput,
  sinceDays = 120,
): Promise<UnitGroup[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const apps = await prisma.application.findMany({
    where: { lead: leadWhere, ...propertyClause, createdAt: { gte: since } },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      status: true,
      applicantRole: true,
      applicationGroupId: true,
      unitName: true,
      unitExternalId: true,
      desiredMoveIn: true,
      receivedAt: true,
      appliedAt: true,
      decidedAt: true,
      createdAt: true,
      screeningStatus: true,
      property: { select: { id: true, name: true } },
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  // unitKey -> UnitGroup (preserve a stable map; sort at the end)
  const units = new Map<string, UnitGroup>();
  // unitKey -> groupId -> ApplicationGroup
  const groupsByUnit = new Map<string, Map<string, ApplicationGroup>>();

  for (const app of apps) {
    const unitId = app.unitExternalId ?? app.unitName ?? NO_UNIT;
    // Namespace the unit key by property so identical AppFolio unit ids across
    // properties never collapse into one card.
    const unitKey = `${app.property.id}::${unitId}`;

    if (!units.has(unitKey)) {
      units.set(unitKey, {
        unitKey,
        unitName: app.unitName ?? (unitId === NO_UNIT ? "Unassigned unit" : unitId),
        propertyId: app.property.id,
        propertyName: app.property.name,
        applicantCount: 0,
        receivedAt: null,
        groups: [],
      });
      groupsByUnit.set(unitKey, new Map());
    }
    const unit = units.get(unitKey)!;
    const groupMap = groupsByUnit.get(unitKey)!;

    const card: ApplicantCard = {
      applicationId: app.id,
      leadId: app.lead.id,
      name: displayName(app.lead),
      email: app.lead.email,
      phone: app.lead.phone,
      status: app.status,
      role: app.applicantRole,
      isPrimary: app.applicantRole === ApplicantRole.PRIMARY,
      desiredMoveIn: app.desiredMoveIn,
      receivedAt: app.receivedAt,
      appliedAt: app.appliedAt,
      decidedAt: app.decidedAt,
      createdAt: app.createdAt,
      screeningStatus: app.screeningStatus,
    };

    const groupId = app.applicationGroupId ?? app.id;
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, {
        groupId,
        primaryName: card.name,
        status: app.status,
        receivedAt: card.receivedAt,
        applicants: [],
      });
    }
    const group = groupMap.get(groupId)!;
    group.applicants.push(card);
    group.receivedAt = laterOf(group.receivedAt, card.receivedAt);
    unit.receivedAt = laterOf(unit.receivedAt, card.receivedAt);
    unit.applicantCount += 1;
  }

  // Finalize: sort applicants, resolve primary name + group status rollup,
  // sort groups + units by recency.
  const result: UnitGroup[] = [];
  for (const [unitKey, unit] of units) {
    const groupMap = groupsByUnit.get(unitKey)!;
    const groups = Array.from(groupMap.values());
    for (const group of groups) {
      group.applicants.sort(applicantSort);
      const primary = group.applicants[0];
      group.primaryName = primary?.name ?? group.primaryName;
      group.status = primary?.status ?? group.status;
    }
    groups.sort(
      (a, b) =>
        (b.receivedAt?.getTime() ?? 0) - (a.receivedAt?.getTime() ?? 0),
    );
    unit.groups = groups;
    result.push(unit);
  }
  result.sort(
    (a, b) => (b.receivedAt?.getTime() ?? 0) - (a.receivedAt?.getTime() ?? 0),
  );
  return result;
}
