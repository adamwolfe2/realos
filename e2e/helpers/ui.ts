import { expect, type Locator } from "@playwright/test";

// Click that survives the pre-hydration dead zone on heavy pages: a click
// on server-rendered HTML before React attaches handlers is silently lost.
// Retry the click until its expected effect shows up.
export async function clickAndExpect(
  button: Locator,
  expected: Locator,
  timeout = 30_000
): Promise<void> {
  await expect(async () => {
    await button.click();
    await expect(expected).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout });
}
