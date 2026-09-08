import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("a [[link]] to a note that doesn't exist yet resolves once that note is created", async ({ page }) => {
  await registerAndEnterVault(page, "Link Test");
  await createNote(page, "On writing systems", "See [[Atomicity]] for why one idea per note.");
  await createNote(page, "Atomicity", "One idea per note, in your own words.");

  await expect(page.getByText(/linked mentions \(1\)/i)).toBeVisible();
  await expect(page.locator("aside").last().getByText("On writing systems")).toBeVisible();
});

test("Cmd/Ctrl+click on a [[link]] navigates to the target note", async ({ page }) => {
  await registerAndEnterVault(page, "Nav Test");
  await createNote(page, "Existing Note", "the destination");
  await createNote(page, "Source Note", "jump via [[Existing Note]] please");

  await page.locator(".cm-wikilink").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator('input[class*="font-display"]')).toHaveValue("Existing Note");
});

test("Cmd/Ctrl+click on a [[link]] to a missing note creates it", async ({ page }) => {
  await registerAndEnterVault(page, "Create Via Link");
  await createNote(page, "Source Note", "not yet written: [[Brand New Target]]");

  await page.locator(".cm-wikilink").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator('input[class*="font-display"]')).toHaveValue("Brand New Target");
});
