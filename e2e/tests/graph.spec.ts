import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("graph view renders the vault's notes and can be closed", async ({ page }) => {
  await registerAndEnterVault(page, "Graph Test");
  await createNote(page, "Atomicity", "See [[Linking]] for how notes connect.");
  await createNote(page, "Linking", "Notes gain value once they connect to others.");

  await page.getByRole("button", { name: "Graph view" }).click();

  await expect(page.getByTestId("graph-view")).toBeVisible();
  await expect(page.getByTestId("graph-view").locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("graph-view")).not.toBeVisible();
});

test("graph view offers a local/whole-vault scope toggle when a note is open", async ({ page }) => {
  await registerAndEnterVault(page, "Graph Scope Test");
  await createNote(page, "Solo note", "no links");

  await page.getByRole("button", { name: "Graph view" }).click();

  await expect(page.getByRole("button", { name: "This note" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Whole vault" })).toBeVisible();

  await page.getByRole("button", { name: "Whole vault" }).click();
  await expect(page.getByTestId("graph-view").locator("canvas")).toBeVisible();
});
