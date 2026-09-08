import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("creating a second vault switches to it with its own, separate note list", async ({ page }) => {
  await registerAndEnterVault(page, "Vault Test");
  // Deliberately avoid the word "vault" in the note title: the vault-switcher
  // button is also named "My Vault ▾", and a sidebar note whose title contains
  // that word makes getByRole("button", { name: /my vault/i }) ambiguous.
  await createNote(page, "First note", "belongs to the default vault");

  await page.getByRole("button", { name: /my vault/i }).click();
  await page.getByPlaceholder("New vault name").fill("Research");
  await page.getByRole("button", { name: "+", exact: true }).click();

  await expect(page.getByRole("button", { name: /research/i })).toBeVisible();
  await expect(page.getByText(/your vault is empty/i)).toBeVisible();
  await expect(page.locator("aside").first().getByText("First note")).not.toBeVisible();
});

test("switching back to the original vault still shows its notes", async ({ page }) => {
  await registerAndEnterVault(page, "Vault Switch Back");
  await createNote(page, "Original note", "content");

  await page.getByRole("button", { name: /my vault/i }).click();
  await page.getByPlaceholder("New vault name").fill("Second Vault");
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(page.getByText(/your vault is empty/i)).toBeVisible();

  await page.getByRole("button", { name: /second vault/i }).click();
  await page.getByText("My Vault", { exact: true }).click();

  await expect(page.locator("aside").first().getByText("Original note")).toBeVisible();
});
