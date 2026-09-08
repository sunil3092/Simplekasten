import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("marking a note as Structure surfaces it in the sidebar's Maps of content section", async ({ page }) => {
  await registerAndEnterVault(page, "MoC Sidebar Test");
  await createNote(page, "Zettelkasten MoC", "An index note.");

  await page.locator("select").selectOption("structure");
  await expect(page.getByText("Saved")).toBeVisible();

  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("Maps of content", { exact: false })).toBeVisible();
  await expect(sidebar.locator("button", { hasText: "Zettelkasten MoC" })).toHaveCount(2); // once in the note list, once in the MoC section
});

test("a structure note's [[links]] render as a Contents list, resolved links included with their zettel ID", async ({
  page,
}) => {
  await registerAndEnterVault(page, "MoC Contents Test");
  await createNote(page, "Atomicity", "One idea per note.");
  await createNote(page, "Zettelkasten MoC", "See [[Atomicity]] and [[Not Written Yet]].");
  await page.locator("select").selectOption("structure");
  await expect(page.getByText("Saved")).toBeVisible();

  const rightPanel = page.locator("aside").last();
  await expect(rightPanel.getByText(/^Contents \(2\)$/)).toBeVisible();
  await expect(rightPanel.getByText("Atomicity")).toBeVisible();
  await expect(rightPanel.getByText("Not Written Yet")).toBeVisible();

  await rightPanel.getByText("Atomicity").click();
  await expect(page.locator('input[class*="font-display"]')).toHaveValue("Atomicity");
});

test("clicking an unresolved item in the Contents list creates that note", async ({ page }) => {
  await registerAndEnterVault(page, "MoC Create Test");
  await createNote(page, "Zettelkasten MoC", "See [[Brand New Note]].");
  await page.locator("select").selectOption("structure");
  await expect(page.getByText("Saved")).toBeVisible();

  await page.locator("aside").last().getByText("Brand New Note", { exact: true }).click();
  await expect(page.locator('input[class*="font-display"]')).toHaveValue("Brand New Note");
});
