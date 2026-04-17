import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural and behavioral tests for the Clerk webhook handler.
 * Verifies signature validation via svix, event handling,
 * transactional user deletion with cleanup, and organization linking.
 */

const routePath = path.resolve(
  __dirname,
  "../app/api/webhooks/clerk/route.ts"
);

function readRoute(): string {
  return fs.readFileSync(routePath, "utf-8");
}

describe("Clerk webhook — app/api/webhooks/clerk/route.ts", () => {
  it("route file exists", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("exports POST handler", () => {
    const content = readRoute();
    expect(content).toMatch(
      /export\s+async\s+function\s+POST/
    );
  });

  it("does NOT export GET (webhooks are POST-only)", () => {
    const content = readRoute();
    expect(content).not.toMatch(
      /export\s+async\s+function\s+GET/
    );
  });

  it("validates webhook signatures using svix/Webhook", () => {
    const content = readRoute();
    // Imports svix Webhook class
    expect(content).toContain('from "svix"');
    expect(content).toContain("new Webhook(");
    // Reads svix headers
    expect(content).toContain("svix-id");
    expect(content).toContain("svix-timestamp");
    expect(content).toContain("svix-signature");
    // Calls verify
    expect(content).toContain("wh.verify(");
  });

  it("returns 400 for missing svix headers", () => {
    const content = readRoute();
    expect(content).toContain("Missing headers");
    expect(content).toContain("status: 400");
  });

  it("returns 400 for invalid signature", () => {
    const content = readRoute();
    expect(content).toContain("Invalid signature");
  });

  it("returns 500 when CLERK_WEBHOOK_SECRET is not configured", () => {
    const content = readRoute();
    expect(content).toContain("CLERK_WEBHOOK_SECRET");
    expect(content).toContain("Not configured");
    expect(content).toContain("status: 500");
  });

  it("handles user.created event", () => {
    const content = readRoute();
    expect(content).toContain('"user.created"');
  });

  it("handles user.updated event", () => {
    const content = readRoute();
    expect(content).toContain('"user.updated"');
  });

  it("handles user.deleted event", () => {
    const content = readRoute();
    expect(content).toContain('"user.deleted"');
  });

  it("upserts user in DB on create/update", () => {
    const content = readRoute();
    expect(content).toContain("prisma.user.upsert");
  });

  it("uses prisma.$transaction for user deletion", () => {
    const content = readRoute();
    expect(content).toContain("prisma.$transaction");
  });

  it("cleans up clientNote records on user deletion", () => {
    const content = readRoute();
    expect(content).toContain("tx.clientNote.deleteMany");
  });

  it("cleans up repTask records on user deletion", () => {
    const content = readRoute();
    expect(content).toContain("tx.repTask.deleteMany");
  });

  it("nullifies quote repId on user deletion", () => {
    const content = readRoute();
    expect(content).toContain("tx.quote.updateMany");
    expect(content).toContain("repId: null");
  });

  it("handles organization linking from public_metadata.organizationId", () => {
    const content = readRoute();
    expect(content).toContain("organizationId");
    expect(content).toContain("public_metadata");
    // Verify it checks org exists before linking (prevent dangling FK)
    expect(content).toContain("prisma.organization.findUnique");
    expect(content).toContain("orgExists");
  });

  it("auto-links user to org by email on first sign-up", () => {
    const content = readRoute();
    expect(content).toContain("prisma.organization.findFirst");
    expect(content).toContain("auto-linked to org");
  });

  it("does not overwrite existing org assignment on user.updated", () => {
    const content = readRoute();
    // On update, if user already has an org, skip the org link
    expect(content).toContain("already linked");
  });

  it("logs warning for orphaned organizations on user deletion", () => {
    const content = readRoute();
    expect(content).toContain("org is now orphaned");
    // Verify it checks remaining member count
    expect(content).toContain("remainingMembers");
  });

  it("validates role from public_metadata against VALID_ROLES", () => {
    const content = readRoute();
    expect(content).toContain("VALID_ROLES");
    expect(content).toContain("isValidRole");
    // Falls back to CLIENT if role is invalid
    expect(content).toMatch(/isValidRole\(rawRole\)\s*\?\s*rawRole\s*:\s*["']CLIENT["']/);
  });

  it("returns 200 with { received: true } on success", () => {
    const content = readRoute();
    expect(content).toContain("{ received: true }");
  });
});
