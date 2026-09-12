import { expect, test } from "@playwright/test";
import { registerAndEnterVault } from "./helpers";

test("the vault repaints with the dark palette under prefers-color-scheme: dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await registerAndEnterVault(page, "Theme Test");
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: "dark" });
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  expect(darkBg).not.toBe(lightBg);
  // --color-bg dark value is #0b1120 == rgb(11, 17, 32).
  expect(darkBg).toBe("rgb(11, 17, 32)");
});
