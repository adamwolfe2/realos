import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { UserRole } from "@prisma/client";
import { canRunWizard } from "../lib/onboarding/wizard-auth";

describe("onboarding wizard role gate", () => {
  it("only owner/admin seats run the wizard", () => {
    expect(canRunWizard(UserRole.CLIENT_OWNER)).toBe(true);
    expect(canRunWizard(UserRole.CLIENT_ADMIN)).toBe(true);
    expect(canRunWizard(UserRole.CLIENT_VIEWER)).toBe(false);
    expect(canRunWizard(UserRole.LEASING_AGENT)).toBe(false);
  });

  it("/onboarding shows the waiting screen to seats that can't run the wizard", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../app/onboarding/page.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/if \(!canRunWizard\(user\.role\)\)/);
    expect(src).toContain("<WaitingForAdmin");
  });
});
