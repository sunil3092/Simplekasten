import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("an expired access token is silently refreshed on reload, with no visible failure", async ({ page }) => {
  await registerAndEnterVault(page, "Session Test");
  await createNote(page, "Survives expiry", "content");

  const accessBefore = await page.evaluate(() => localStorage.getItem("simplekasten_access_token"));
  expect(accessBefore).toBeTruthy();

  // Simulate 15 minutes passing without actually waiting: swap in a token the
  // API will reject, while leaving the real refresh token in place.
  await page.evaluate(() => localStorage.setItem("simplekasten_access_token", "expired.garbage.token"));
  await page.reload();

  // A broken refresh flow would strand the user on a blank or errored screen;
  // a working one reaches the normal, populated vault view instead.
  await expect(page.getByText(/your vault is empty/i)).not.toBeVisible();
  await expect(page.locator("aside").first().getByText("Survives expiry")).toBeVisible();

  const accessAfter = await page.evaluate(() => localStorage.getItem("simplekasten_access_token"));
  expect(accessAfter).not.toBe("expired.garbage.token");
});

test("a completely invalid refresh token forces the user back to the login screen", async ({ page }) => {
  await registerAndEnterVault(page, "Force Logout Test");

  await page.evaluate(() => {
    localStorage.setItem("simplekasten_access_token", "expired.garbage.token");
    localStorage.setItem("simplekasten_refresh_token", "never-issued-refresh-token");
  });
  await page.reload();

  await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
});
