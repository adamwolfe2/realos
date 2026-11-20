import { isValidEmail } from "@/lib/email/shared";

// Groups digest recipients by what they may see. A member with any
// UserPropertyAccess row is property-restricted (lib/tenancy/scope.ts:
// grants => allowedPropertyIds), so the digest built for them must cover
// only those properties. Members without grants see the whole org.
//   propertyIds null  -> org-wide digest
//   propertyIds [...] -> digest scoped to exactly those properties
export type DigestAudience = {
  propertyIds: string[] | null;
  emails: string[];
};

export function digestAudiences(
  members: Array<{ email: string | null; propertyAccess: Array<{ propertyId: string }> }>,
): DigestAudience[] {
  const byKey = new Map<string, DigestAudience>();
  for (const m of members) {
    if (!m.email || !isValidEmail(m.email)) continue;
    const ids =
      m.propertyAccess.length > 0
        ? [...new Set(m.propertyAccess.map((g) => g.propertyId))].sort()
        : null;
    const key = ids ? ids.join(",") : "*";
    const audience = byKey.get(key) ?? { propertyIds: ids, emails: [] };
    byKey.set(key, { ...audience, emails: [...audience.emails, m.email] });
  }
  return [...byKey.values()];
}
