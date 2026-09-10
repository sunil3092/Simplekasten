import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("Cmd/Ctrl+K search finds a note by body content, not just its title, with a highlighted snippet", async ({
  page,
}) => {
  await registerAndEnterVault(page, "Search Test");
  await createNote(page, "Finch beaks", "Galapagos finches show rapid beak-shape shifts under drought.");
  await createNote(page, "Unrelated note", "nothing to do with birds");

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/search notes/i).fill("drought");

  await expect(page.locator("mark", { hasText: "drought" })).toBeVisible();
  // "Finch beaks" also exists in the sidebar behind the modal overlay —
  // scope to the result row that actually contains the highlighted snippet.
  await page.locator("li").filter({ has: page.locator("mark") }).click();

  await expect(page.locator('input[class*="font-display"]')).toHaveValue("Finch beaks");
});

test("the switcher offers to create a note when the typed title matches nothing", async ({ page }) => {
  await registerAndEnterVault(page, "Switcher Create");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/search notes/i).fill("A totally new idea");

  await page.getByText(/create.*a totally new idea/i).click();
  await expect(page.locator('input[class*="font-display"]')).toHaveValue("A totally new idea");
});

test("Escape closes the switcher without navigating", async ({ page }) => {
  await registerAndEnterVault(page, "Switcher Escape");
  await createNote(page, "Stay here", "content");

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/search notes/i).waitFor();
  await page.keyboard.press("Escape");

  await expect(page.getByPlaceholder(/search notes/i)).not.toBeVisible();
  await expect(page.locator('input[class*="font-display"]')).toHaveValue("Stay here");
});
