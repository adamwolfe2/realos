import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the homepage section components and the
 * marketing page that assembles them. Verifies all section files exist,
 * export named components, and are referenced in page.tsx.
 */

const HOMEPAGE_DIR = path.resolve(__dirname, "../components/homepage");
const PAGE_PATH = path.resolve(__dirname, "../app/(marketing)/page.tsx");

const EXPECTED_SECTIONS = [
  "additional-features-section.tsx",
  "amazon-effect-section.tsx",
  "before-after-section.tsx",
  "cta-section.tsx",
  "demo-section.tsx",
  "erp-alternative-section.tsx",
  "faq-section.tsx",
  "features-section.tsx",
  "footer-section.tsx",
  "growth-section.tsx",
  "hero-section.tsx",
  "how-it-works-section.tsx",
  "included-section.tsx",
  "industries-section.tsx",
  "intake-section.tsx",
  "pain-point-section.tsx",
  "pricing-section.tsx",
  "sail-logo.tsx",
  "stats-section.tsx",
  "testimonials-section.tsx",
];

describe("homepage section files", () => {
  it(`has all ${EXPECTED_SECTIONS.length} expected section files`, () => {
    const missing = EXPECTED_SECTIONS.filter(
      (f) => !fs.existsSync(path.join(HOMEPAGE_DIR, f))
    );
    expect(missing).toEqual([]);
  });

  for (const file of EXPECTED_SECTIONS) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(HOMEPAGE_DIR, file))).toBe(true);
    });
  }
});

describe("homepage sections export named components", () => {
  for (const file of EXPECTED_SECTIONS) {
    it(`${file} exports a named function`, () => {
      const content = fs.readFileSync(
        path.join(HOMEPAGE_DIR, file),
        "utf-8"
      );
      const hasNamedExport = content.match(
        /export\s+(default\s+)?function\s+\w+/
      );
      expect(hasNamedExport).not.toBeNull();
    });
  }

  // Map file names to expected export names
  const FILE_TO_EXPORT: Record<string, string> = {
    "hero-section.tsx": "HeroSection",
    "stats-section.tsx": "StatsSection",
    "before-after-section.tsx": "BeforeAfterSection",
    "erp-alternative-section.tsx": "ErpAlternativeSection",
    "testimonials-section.tsx": "TestimonialsSection",
    "demo-section.tsx": "DemoSection",
    "amazon-effect-section.tsx": "AmazonEffectSection",
    "industries-section.tsx": "IndustriesSection",
    "pain-point-section.tsx": "PainPointSection",
    "features-section.tsx": "FeaturesSection",
    "included-section.tsx": "IncludedSection",
    "pricing-section.tsx": "PricingSection",
    "growth-section.tsx": "GrowthSection",
    "how-it-works-section.tsx": "HowItWorksSection",
    "additional-features-section.tsx": "AdditionalFeaturesSection",
    "faq-section.tsx": "FaqSection",
    "cta-section.tsx": "CtaSection",
    "intake-section.tsx": "IntakeSection",
    "footer-section.tsx": "FooterSection",
    "sail-logo.tsx": "SailLogo",
  };

  for (const [file, exportName] of Object.entries(FILE_TO_EXPORT)) {
    it(`${file} exports ${exportName}`, () => {
      const content = fs.readFileSync(
        path.join(HOMEPAGE_DIR, file),
        "utf-8"
      );
      expect(content).toContain(`export function ${exportName}`);
    });
  }
});

describe("marketing page.tsx imports all sections", () => {
  const pageContent = fs.readFileSync(PAGE_PATH, "utf-8");

  // All section imports that page.tsx should have (excluding sail-logo which is
  // a utility component, not a page section)
  const SECTIONS_USED_IN_PAGE = [
    "HeroSection",
    "StatsSection",
    "BeforeAfterSection",
    "ErpAlternativeSection",
    "TestimonialsSection",
    "DemoSection",
    "AmazonEffectSection",
    "IndustriesSection",
    "PainPointSection",
    "FeaturesSection",
    "IncludedSection",
    "PricingSection",
    "GrowthSection",
    "HowItWorksSection",
    "AdditionalFeaturesSection",
    "FaqSection",
    "CtaSection",
    "IntakeSection",
    "FooterSection",
  ];

  for (const section of SECTIONS_USED_IN_PAGE) {
    it(`imports ${section}`, () => {
      expect(pageContent).toContain(section);
    });
  }

  it("renders all sections in JSX", () => {
    for (const section of SECTIONS_USED_IN_PAGE) {
      expect(pageContent).toContain(`<${section}`);
    }
  });
});
