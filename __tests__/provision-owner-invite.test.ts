// An owner invite (create-client / convert-intake / proposal provisioning)
// has no seed row: the org's primaryContactEmail is the durable record. If
// the user.created webhook failed, the sign-in self-heal must bind the owner
// to that org, not create a new empty workspace (#181 follow-up).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/analytics-server", () => ({ trackServer: vi.fn() }));
vi.mock("@/lib/notifications/funnel-alert", () => ({ alertFunnelStep: vi.fn() }));

const { provisionUserForClerk } = await import("@/lib/auth/provision");
const ARGS = { clerkUserId: "user_new", email: "Owner@Acme.com", firstName: "O", lastName: null };

beforeEach(() => {
  vi.resetAllMocks();
  h.db.user.findUnique.mockResolvedValue(null); // no row by clerkUserId or email
  h.db.organization.findUnique.mockResolvedValue(null);
});

describe("provisionUserForClerk owner-invite self-heal", () => {
  it("binds the owner to the org naming them as primary contact", async () => {
    h.db.organization.findFirst.mockResolvedValue({ id: "acme" });
    h.db.user.create.mockResolvedValue({
      id: "u1",
      role: "CLIENT_OWNER",
      orgId: "acme",
      org: { orgType: "CLIENT", slug: "acme" },
    });
    const r = await provisionUserForClerk(ARGS);
    expect(r).toMatchObject({ orgId: "acme", role: "CLIENT_OWNER", created: false });
    const data = h.db.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ orgId: "acme", role: "CLIENT_OWNER", email: "owner@acme.com" });
    expect(data).not.toHaveProperty("org"); // no nested greenfield org
  });

  it("only matches CLIENT orgs this email was never removed from, escaped and case-insensitive", async () => {
    h.db.organization.findFirst.mockResolvedValue(null);
    h.db.user.create.mockResolvedValue({ id: "u1", role: "CLIENT_OWNER", orgId: "new", org: { orgType: "CLIENT", slug: "x" } });
    await provisionUserForClerk({ ...ARGS, email: "a_b@acme.com" });
    expect(h.db.organization.findFirst.mock.calls[0][0]).toMatchObject({
      where: {
        primaryContactEmail: { equals: "a\\_b@acme.com", mode: "insensitive" },
        orgType: "CLIENT",
        // THIS email was removed from the org before: no re-bind. Other
        // teammates' joins or removals don't block the owner (Codex P1 x2).
        auditEvents: {
          none: {
            action: "DELETE",
            entityType: "User",
            OR: [
              { diff: { path: ["removedEmail"], equals: "a_b@acme.com" } },
              { description: { startsWith: "Removed a\\_b@acme.com (", mode: "insensitive" } },
            ],
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    // No match: greenfield workspace as before.
    expect(h.db.user.create.mock.calls[0][0].data.org).toHaveProperty("create");
  });
});

describe("team removal writes its durable record atomically", () => {
  it.each(["removeUserFromOrgAsAgency", "removeUserFromOrgAsClient"])(
    "%s deletes the user and writes the DELETE/User audit in one transaction",
    async (fn) => {
      const fs = await import("fs");
      const src = fs.readFileSync("lib/actions/manage-team.ts", "utf8");
      const start = src.indexOf(`export async function ${fn}(`);
      const body = src.slice(start, src.indexOf("\nexport async function", start + 1));
      expect(body).toMatch(/\$transaction\(\[\s*prisma\.user\.delete\([\s\S]*?prisma\.auditEvent\.create\(/);
      expect(body).not.toMatch(/await prisma\.user\.delete\(/);
      expect(body).toMatch(/diff: \{ removedEmail: \w+\.email\.toLowerCase\(\) \}/);
    },
  );
});
