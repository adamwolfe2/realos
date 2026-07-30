import { describe, it, expect } from "vitest";
import { stepHasValidAnswer } from "@/components/audit/digital-score-quiz";
import { QUIZ_QUESTIONS } from "@/lib/audit/quiz-questions";
import type { Question } from "@/lib/audit/quiz-questions";

// ---------------------------------------------------------------------------
// Regression for AUDIT-MAGNET-D002: optional (non-required) quiz steps kept
// the Next button disabled until the visitor touched something, because
// stepHasValidAnswer treated "the answer key exists" as the bar for validity.
// An untouched optional step must be allowed to advance.
// ---------------------------------------------------------------------------

const optionalMultiQuestion: Question = {
  id: "site_features",
  kind: "multi",
  prompt: "test",
  pillars: ["conversion"],
  required: false,
  choices: [{ id: "a", label: "A" }],
};

const requiredQuestion: Question = {
  id: "property_type",
  kind: "single",
  prompt: "test",
  pillars: ["conversion"],
  required: true,
  choices: [{ id: "a", label: "A" }],
};

describe("stepHasValidAnswer optional-step advance (AUDIT-MAGNET-D002)", () => {
  it("lets an untouched optional step advance", () => {
    expect(stepHasValidAnswer(optionalMultiQuestion, undefined)).toBe(true);
  });

  it("still lets a touched optional step advance", () => {
    expect(stepHasValidAnswer(optionalMultiQuestion, ["a"])).toBe(true);
    expect(stepHasValidAnswer(optionalMultiQuestion, [])).toBe(true);
  });

  it("still blocks an untouched required step", () => {
    expect(stepHasValidAnswer(requiredQuestion, undefined)).toBe(false);
  });

  it("still blocks an empty-string answer on a required step", () => {
    expect(stepHasValidAnswer(requiredQuestion, "")).toBe(false);
  });

  it("allows a required step once answered", () => {
    expect(stepHasValidAnswer(requiredQuestion, "a")).toBe(true);
  });
});

describe("lead_sources has a 'None of these' choice like site_features (AUDIT-MAGNET-D002)", () => {
  it("both optional multi-select steps offer an explicit none option", () => {
    const leadSources = QUIZ_QUESTIONS.find((q) => q.id === "lead_sources")!;
    const siteFeatures = QUIZ_QUESTIONS.find((q) => q.id === "site_features")!;
    expect(leadSources.choices?.some((c) => c.id.startsWith("none"))).toBe(
      true,
    );
    expect(siteFeatures.choices?.some((c) => c.id.startsWith("none"))).toBe(
      true,
    );
  });
});
