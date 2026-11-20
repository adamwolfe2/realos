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
  members: Array<{
    email: string | null;
    propertyAccessRestricted: boolean;
    propertyAccess: Array<{ propertyId: string }>;
  }>,
): DigestAudience[] {
  const byKey = new Map<string, DigestAudience>();
  for (const m of members) {
    if (!m.email || !isValidEmail(m.email)) continue;
    // A restricted seat that lost every grant is locked out of the portal
    // (scope.ts); it must not fall through to the org-wide digest either.
    if (m.propertyAccessRestricted && m.propertyAccess.length === 0) continue;
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
