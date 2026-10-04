import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// F-024 review H-1: Prisma compiles `{ equals, mode: "insensitive" }` to
// `email ILIKE $1` (verified by logging the SQL from @prisma/client 7.4.1),
// so an unescaped `_` matched any character and `john_doe@x.com` merged into
// the `john.doe@x.com` lead. The shared helper escapes LIKE metacharacters.
// ---------------------------------------------------------------------------

const lead = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { lead } }));

const { findOldestLeadByEmail, escapeLikePattern } = await import(
  "@/lib/leads/find-by-email"
);

// Postgres ILIKE semantics with the default `\` escape, for asserting what
// the escaped pattern would match.
function ilike(value: string, pattern: string): boolean {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "_") re += ".";
    else if (c === "%") re += ".*";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "is").test(value);
}

beforeEach(() => lead.findFirst.mockReset());

describe("findOldestLeadByEmail", () => {
  it("escapes LIKE wildcards so john_doe does not match john.doe", async () => {
    await findOldestLeadByEmail("org_1", "  John_Doe@X.com ", { id: true });

    const args = lead.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({
      orgId: "org_1",
      email: { equals: "john\\_doe@x.com", mode: "insensitive" },
    });
    expect(args.orderBy).toEqual({ createdAt: "asc" });
    expect(args.select).toEqual({ id: true });

    const pattern = args.where.email.equals;
    expect(ilike("john.doe@x.com", pattern)).toBe(false);
    expect(ilike("JOHN_DOE@x.com", pattern)).toBe(true);
    // Sanity: the unescaped value would have matched (the bug).
    expect(ilike("john.doe@x.com", "john_doe@x.com")).toBe(true);
  });

  it("escapes % and backslash too", () => {
    expect(escapeLikePattern("a%b\\c_d")).toBe("a\\%b\\\\c\\_d");
  });
});
