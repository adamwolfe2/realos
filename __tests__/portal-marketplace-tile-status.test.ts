import { describe, it, expect } from "vitest";
import {
  getTileViewState,
  formatPrice,
  type TileKind,
} from "@/components/portal/marketplace/tile-view-state";

// ---------------------------------------------------------------------------
// Table test for the /portal/marketplace tile status/price/CTA mapping.
// Regression lock for the launch-polish bug: concierge + addon tiles used
// to ignore `isEnabled` entirely and always render "Not active" / a
// checkout-style CTA, even for orgs where ops had already turned the module
// on. Every kind x on/off combination below must agree: an "active" status
// never pairs with a CTA that offers to (re)purchase or (re)request it.
// ---------------------------------------------------------------------------

const BASE = {
  isTrialing: false,
  isPending: false,
  isNotified: false,
  popular: false,
  monthlyPriceCents: 9900,
};

describe("getTileViewState", () => {
  it("formats prices", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(9900)).toBe("$99");
    expect(formatPrice(24950)).toBe("$249.50");
  });

  it("toggle, off, trialing -> Not active / Free during trial / Activate", () => {
    const v = getTileViewState({ ...BASE, kind: "toggle", isEnabled: false, isTrialing: true });
    expect(v.status).toBe("not_active");
    expect(v.priceText).toBe("Free during trial");
    expect(v.cta).toEqual({ action: "activate", label: "Activate", disabled: false });
  });

  it("toggle, off, post-trial -> Not active / $99/mo / Unlock", () => {
    const v = getTileViewState({ ...BASE, kind: "toggle", isEnabled: false, isTrialing: false });
    expect(v.status).toBe("not_active");
    expect(v.priceText).toBe("$99");
    expect(v.priceSuffix).toBe("/mo");
    expect(v.cta).toEqual({ action: "activate", label: "Unlock", disabled: false });
  });

  it("toggle, off, popular -> statusNote Popular", () => {
    const v = getTileViewState({ ...BASE, kind: "toggle", isEnabled: false, popular: true });
    expect(v.statusNote).toBe("Popular");
  });

  it("toggle, on -> Active / manage CTA (Set up + Remove)", () => {
    const v = getTileViewState({ ...BASE, kind: "toggle", isEnabled: true });
    expect(v.status).toBe("active");
    expect(v.statusNote).toBeNull();
    expect(v.cta).toEqual({ action: "manage", setupLabel: "Set up", removeLabel: "Remove", disabled: false });
  });

  it("toggle, on, pending -> manage CTA disabled", () => {
    const v = getTileViewState({ ...BASE, kind: "toggle", isEnabled: true, isPending: true });
    expect(v.cta).toEqual({ action: "manage", setupLabel: "Set up", removeLabel: "Remove", disabled: true });
  });

  it("included -> always Active / Included free / Open (isEnabled ignored)", () => {
    for (const isEnabled of [true, false]) {
      const v = getTileViewState({ ...BASE, kind: "included", isEnabled });
      expect(v.status).toBe("active");
      expect(v.priceText).toBe("Included free");
      expect(v.cta).toEqual({ action: "open", label: "Open" });
    }
  });

  it("coming -> always Not active / Coming soon / Notify me (isEnabled ignored)", () => {
    for (const isEnabled of [true, false]) {
      const v = getTileViewState({ ...BASE, kind: "coming", isEnabled });
      expect(v.status).toBe("not_active");
      expect(v.statusNote).toBe("Coming soon");
      expect(v.priceText).toBe("Coming soon");
      expect(v.cta).toEqual({ action: "notify", label: "Notify me", disabled: false });
    }
  });

  it("coming, already notified -> Notified, disabled", () => {
    const v = getTileViewState({ ...BASE, kind: "coming", isEnabled: false, isNotified: true });
    expect(v.cta).toEqual({ action: "notify", label: "Notified", disabled: true });
  });

  it("concierge, off -> Not active / Guided setup / from $99/mo / Request setup", () => {
    const v = getTileViewState({ ...BASE, kind: "concierge", isEnabled: false });
    expect(v.status).toBe("not_active");
    expect(v.statusNote).toBe("Guided setup");
    expect(v.priceText).toBe("from $99");
    expect(v.cta).toEqual({ action: "request", label: "Request setup" });
  });

  // Regression: this used to stay "Not active" / "Request setup" even once
  // ops had flipped org.moduleWebsite / org.moduleSEO on for a paying org.
  it("concierge, on -> Active / no note / $99/mo / Open", () => {
    const v = getTileViewState({ ...BASE, kind: "concierge", isEnabled: true });
    expect(v.status).toBe("active");
    expect(v.statusNote).toBeNull();
    expect(v.priceText).toBe("$99");
    expect(v.cta).toEqual({ action: "open", label: "Open" });
  });

  it("addon, off -> Not active / Pro add-on / +$99/mo / Add", () => {
    const v = getTileViewState({ ...BASE, kind: "addon", isEnabled: false });
    expect(v.status).toBe("not_active");
    expect(v.statusNote).toBe("Pro add-on");
    expect(v.priceText).toBe("+$99");
    expect(v.cta).toEqual({ action: "add", label: "Add" });
  });

  it("addon, on -> Active / no note / +$99/mo / Open", () => {
    const v = getTileViewState({ ...BASE, kind: "addon", isEnabled: true });
    expect(v.status).toBe("active");
    expect(v.statusNote).toBeNull();
    expect(v.cta).toEqual({ action: "open", label: "Open" });
  });

  it("status and CTA never disagree across every kind x isEnabled combination", () => {
    const kinds: TileKind[] = ["toggle", "included", "concierge", "addon", "coming"];
    for (const kind of kinds) {
      for (const isEnabled of [true, false]) {
        for (const isTrialing of [true, false]) {
          const v = getTileViewState({ ...BASE, kind, isEnabled, isTrialing });
          if (v.status === "active") {
            // An active tile must never offer to (re)purchase/(re)request it.
            expect(["open", "manage"]).toContain(v.cta.action);
          } else {
            expect(["activate", "add", "request", "notify"]).toContain(v.cta.action);
          }
        }
      }
    }
  });
});
