import { describe, it, expect } from "vitest";
import {
  PopupPosition,
  PopupTheme,
  PopupTrigger,
} from "@prisma/client";
import {
  POPUP_TEMPLATES,
  getPopupTemplate,
} from "../lib/popups/templates";

// ---------------------------------------------------------------------------
// Popup templates — shape + invariants.
//
// These tests guard against silent regressions in the template seed data.
// Every popup created via the picker pulls these defaults straight into a
// new PopupCampaign row, so a misshaped default would mean an editor-side
// type mismatch or a saved row with garbage fields.
// ---------------------------------------------------------------------------

describe("POPUP_TEMPLATES", () => {
  it("ships the expected 4 templates with stable ids", () => {
    const ids = POPUP_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      "limited-availability",
      "tour-push",
      "exit-save",
      "referral",
    ]);
  });

  it("every template has a non-empty label, description, and badge", () => {
    for (const t of POPUP_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.badge.length).toBeGreaterThan(0);
    }
  });

  it("every template's defaults carry a name, headline, body, primary CTA, and position", () => {
    for (const t of POPUP_TEMPLATES) {
      expect(t.defaults.name.length).toBeGreaterThan(0);
      expect(t.defaults.headline.length).toBeGreaterThan(0);
      expect(t.defaults.body.length).toBeGreaterThan(0);
      expect(t.defaults.ctaText.length).toBeGreaterThan(0);
      expect(Object.values(PopupPosition)).toContain(t.defaults.position);
    }
  });

  it("every template uses a valid PopupTheme + PopupTrigger", () => {
    for (const t of POPUP_TEMPLATES) {
      expect(Object.values(PopupTheme)).toContain(t.defaults.theme);
      expect(Object.values(PopupTrigger)).toContain(t.defaults.trigger);
    }
  });

  it("every template's `template` field matches its id (so the editor can resolve the template later)", () => {
    for (const t of POPUP_TEMPLATES) {
      expect(t.defaults.template).toBe(t.id);
    }
  });

  it("every template's color fields are 3- or 6-char hex (matches Prisma column regex)", () => {
    const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    for (const t of POPUP_TEMPLATES) {
      expect(t.defaults.primaryColor).toMatch(HEX);
      expect(t.defaults.textColor).toMatch(HEX);
      expect(t.defaults.backgroundColor).toMatch(HEX);
      if (t.defaults.accentColor) {
        expect(t.defaults.accentColor).toMatch(HEX);
      }
      if (t.defaults.gradientColors) {
        for (const stop of t.defaults.gradientColors) {
          expect(stop).toMatch(HEX);
        }
      }
    }
  });
});

describe("limited-availability template (Telegraph reference)", () => {
  const tpl = POPUP_TEMPLATES.find((t) => t.id === "limited-availability")!;

  it("is dark, centered, with dual CTAs and a featured rate card", () => {
    expect(tpl.defaults.theme).toBe(PopupTheme.DARK);
    expect(tpl.defaults.position).toBe(PopupPosition.CENTER);
    expect(tpl.defaults.secondaryCtaText).toBeTruthy();
    expect(tpl.defaults.secondaryCtaUrl).toBeTruthy();
    expect(tpl.defaults.featuredValue).toBeTruthy();
    expect(tpl.defaults.featuredLabel).toBeTruthy();
  });

  it("seeds a gradient accent bar with at least 2 stops", () => {
    expect(Array.isArray(tpl.defaults.gradientColors)).toBe(true);
    expect((tpl.defaults.gradientColors ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("sets an eyebrow and a dismiss link", () => {
    expect(tpl.defaults.eyebrowText).toBeTruthy();
    expect(tpl.defaults.dismissText).toBeTruthy();
  });

  it("uses gold accent color for the price card + eyebrow", () => {
    expect(tpl.defaults.accentColor).toBe("#F5BC1A");
    expect(tpl.defaults.primaryColor).toBe("#F5BC1A");
  });
});

describe("exit-save template", () => {
  const tpl = POPUP_TEMPLATES.find((t) => t.id === "exit-save")!;
  it("is exit-intent triggered and pre-enables email capture", () => {
    expect(tpl.defaults.trigger).toBe(PopupTrigger.EXIT_INTENT);
    expect(tpl.defaults.captureEmail).toBe(true);
    expect(tpl.defaults.position).toBe(PopupPosition.CENTER);
  });
});

describe("tour-push template", () => {
  const tpl = POPUP_TEMPLATES.find((t) => t.id === "tour-push")!;
  it("is single-CTA (no secondary) and time-on-page triggered", () => {
    expect(tpl.defaults.secondaryCtaText ?? null).toBeNull();
    expect(tpl.defaults.trigger).toBe(PopupTrigger.TIME_ON_PAGE);
  });
});

describe("referral template", () => {
  const tpl = POPUP_TEMPLATES.find((t) => t.id === "referral")!;
  it("renders as a bottom-right toast with an offer code", () => {
    expect(tpl.defaults.position).toBe(PopupPosition.BOTTOM_RIGHT);
    expect(tpl.defaults.offerCode).toBeTruthy();
  });
});

describe("getPopupTemplate", () => {
  it("returns the template for a known id", () => {
    const t = getPopupTemplate("limited-availability");
    expect(t).not.toBeNull();
    expect(t?.id).toBe("limited-availability");
  });

  it("returns null for an unknown id", () => {
    expect(getPopupTemplate("not-a-real-template")).toBeNull();
  });

  it("returns null for null / undefined / empty", () => {
    expect(getPopupTemplate(null)).toBeNull();
    expect(getPopupTemplate(undefined)).toBeNull();
    expect(getPopupTemplate("")).toBeNull();
  });
});
