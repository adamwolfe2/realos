import { Prisma } from "@prisma/client";

// Translates the property where-fragments produced by
// lib/tenancy/property-filter.ts (propertyIdsToWhere, propertyWhereFragment,
// marketableScopedPropertyClause, marketableOrgClause) into an SQL
// " and ..." suffix on the "propertyId" column, for raw grouped queries.
// Supported shapes, exactly:
//   {}                                        -> no filter
//   { propertyId: "<id>" }                    -> = id
//   { propertyId: { in: [...] } }             -> in (...)
//   { OR: [<one of the two above>, { propertyId: null }] }
// Anything else returns null so the caller can fall back to Prisma.
export function propertyClauseSql(
  clause: Record<string, unknown>,
): Prisma.Sql | null {
  const keys = Object.keys(clause);
  if (keys.length === 0) return Prisma.empty;
  if (keys.length !== 1) return null;
  if (keys[0] === "propertyId") {
    const cond = idCondition(clause.propertyId);
    return cond ? Prisma.sql` and ${cond}` : null;
  }
  if (keys[0] === "OR" && Array.isArray(clause.OR) && clause.OR.length === 2) {
    const [base, orgLevel] = clause.OR as Array<Record<string, unknown>>;
    const isNullBranch =
      orgLevel !== null &&
      typeof orgLevel === "object" &&
      Object.keys(orgLevel).length === 1 &&
      "propertyId" in orgLevel &&
      orgLevel.propertyId === null;
    if (!isNullBranch || !base || typeof base !== "object") return null;
    if (Object.keys(base).length !== 1 || !("propertyId" in base)) return null;
    const cond = idCondition(base.propertyId);
    return cond
      ? Prisma.sql` and (${cond} or "propertyId" is null)`
      : null;
  }
  return null;
}

function idCondition(value: unknown): Prisma.Sql | null {
  if (typeof value === "string") return Prisma.sql`"propertyId" = ${value}`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    const list = (value as { in?: unknown }).in;
    if (keys.length !== 1 || !Array.isArray(list)) return null;
    if (!list.every((v) => typeof v === "string")) return null;
    // Prisma's `in: []` matches nothing.
    if (list.length === 0) return Prisma.sql`false`;
    return Prisma.sql`"propertyId" in (${Prisma.join(list)})`;
  }
  return null;
}
