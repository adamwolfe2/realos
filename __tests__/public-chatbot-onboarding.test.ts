import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", relPath), "utf-8");
}

describe("public chatbot onboarding", () => {
  it("does not force logged-out prospects into account creation before preview", () => {
    const page = read("app/onboarding/page.tsx");
    const component = read("components/onboarding/public-chatbot-onboarding.tsx");

    expect(page).toContain("return <PublicChatbotOnboarding />");
    expect(page).not.toContain('redirect("/sign-up?redirect_url=/onboarding")');
    expect(component).toContain("Configure the chatbot before creating an account.");
    expect(component).toContain("Continue to account");
    expect(component).toContain("leasestack:public-chatbot-onboarding");
    expect(component).toContain('params.set("redirect_url", "/onboarding")');
  });

  it("routes the chatbot feature page into the live builder magnet", () => {
    // 2026-08-13 (lead-magnet wave 2): the feature page's primary CTA now
    // routes to /build-a-chatbot (live preview trained on the prospect's
    // own site) instead of the /onboarding trial wizard.
    const featurePage = read("app/(platform)/features/chatbot/page.tsx");

    expect(featurePage).toContain('href: "/build-a-chatbot"');
    expect(featurePage).toContain('label: "Create account", href: "/sign-up"');
    expect(featurePage).toContain("The first experience is the product");
    expect(featurePage).toContain("No account, no card.");
  });
});
