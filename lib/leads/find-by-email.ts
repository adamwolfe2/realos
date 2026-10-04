import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// One lookup for "the org's lead for this email", shared by every public
// capture route (form, popup, tours, chatbot) so they dedupe the same way.
//
// Prisma compiles `{ equals, mode: "insensitive" }` to `email ILIKE $1` on
// Postgres (verified 2026-10-04 by logging the SQL from @prisma/client 7.4.1)
// and passes the value through unescaped, so `_` / `%` in an email act as
// wildcards: `john_doe@x.com` would match `john.doe@x.com`. Escaping
// `\ % _` (ILIKE's default escape char is `\`) makes it an exact,
// case-insensitive match. Oldest lead wins when duplicates already exist.
// ---------------------------------------------------------------------------

export function normalizeLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function findOldestLeadByEmail<S extends Prisma.LeadSelect>(
  orgId: string,
  email: string,
  select: S,
) {
  return prisma.lead.findFirst({
    where: {
      orgId,
      email: {
        equals: escapeLikePattern(normalizeLeadEmail(email)),
        mode: "insensitive",
      },
    },
    select,
    orderBy: { createdAt: "asc" },
  });
}
