import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("creating a note shows it in the sidebar and opens it for editing", async ({ page }) => {
  await registerAndEnterVault(page, "Note Creator");
  await createNote(page, "Atomicity", "One idea per note, in your own words.");

  await expect(page.locator("aside").getByText("Atomicity")).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("One idea per note");
});

test("edits autosave and survive a page reload", async ({ page }) => {
  await registerAndEnterVault(page, "Persist Test");
  await createNote(page, "Durable note", "This text must survive a reload.");

  await page.reload();
  await page.getByRole("button", { name: /\+ new note/i }).first().waitFor();

  await expect(page.locator("aside").getByText("Durable note")).toBeVisible();
  await page.locator("aside").getByText("Durable note").click();
  await expect(page.locator(".cm-content")).toContainText("This text must survive a reload.");
});

test("the note type selector changes the colored badge and persists", async ({ page }) => {
  await registerAndEnterVault(page, "Type Test");
  await createNote(page, "A permanent idea", "content");

  await page.locator("select").selectOption("permanent");
  await expect(page.getByText("Saved")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /\+ new note/i }).first().waitFor();
  await page.locator("aside").getByText("A permanent idea").click();
  await expect(page.locator("select")).toHaveValue("permanent");
});

test("reopens the most recently edited note on a fresh load instead of an empty screen", async ({ page }) => {
  await registerAndEnterVault(page, "Reopen Test");
  await createNote(page, "First note", "first");
  await createNote(page, "Second note", "second");

  await page.reload();
  // The most recently edited note (Second) should already be open, not an empty state.
  await expect(page.getByText(/your vault is empty/i)).not.toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("second");
});
