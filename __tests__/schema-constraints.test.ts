import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Validates that critical Prisma schema constraints are in place.
 * Parses schema.prisma as text to verify unique constraints and indexes.
 */

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf-8");

describe("Prisma schema constraints", () => {
  it("Lead.email has @unique", () => {
    const leadBlock = schema.match(/model Lead \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(leadBlock).toContain("email");
    // Match: email String @unique (with potential whitespace)
    expect(leadBlock).toMatch(/email\s+String\s+@unique/);
  });

  it("WholesaleApplication.email has @unique", () => {
    const block =
      schema.match(/model WholesaleApplication \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toContain("email");
    expect(block).toMatch(/email\s+String\s+@unique/);
  });

  it("Lead does NOT have redundant @@index([email])", () => {
    const leadBlock = schema.match(/model Lead \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(leadBlock).not.toContain("@@index([email])");
  });

  it("WholesaleApplication does NOT have redundant @@index([email])", () => {
    const block =
      schema.match(/model WholesaleApplication \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).not.toContain("@@index([email])");
  });

  it("Shipment has onDelete: Cascade from Order", () => {
    const block =
      schema.match(/model Shipment \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/onDelete:\s*Cascade/);
  });

  it("Order has onDelete: Restrict from Organization", () => {
    const block = schema.match(/model Order \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/onDelete:\s*Restrict/);
  });

  it("IntakeSubmission model exists", () => {
    expect(schema).toContain("model IntakeSubmission {");
  });

  it("AuditEvent model exists (used for nurture dedup)", () => {
    expect(schema).toContain("model AuditEvent {");
  });

  it("ReferralStatus enum exists", () => {
    expect(schema).toContain("enum ReferralStatus {");
  });

  it("SupplierSubmissionStatus enum exists", () => {
    expect(schema).toContain("enum SupplierSubmissionStatus {");
  });
});
