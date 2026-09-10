import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("a #hashtag in a note's body becomes a filterable sidebar tag", async ({ page }) => {
  await registerAndEnterVault(page, "Tag Test");
  await createNote(page, "Natural selection", "Variation plus selection pressure. #evolution #biology");
  await createNote(page, "Finch beaks", "Rapid beak-shape shifts under drought. #evolution");

  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("#evolution", { exact: false })).toBeVisible();
  await expect(sidebar.getByText("#biology", { exact: false })).toBeVisible();

  await sidebar.getByText(/#evolution/).click();
  await expect(page.getByText(/2 notes · #evolution/i)).toBeVisible();
  await expect(sidebar.getByText("Natural selection")).toBeVisible();
  await expect(sidebar.getByText("Finch beaks")).toBeVisible();

  await sidebar.getByText(/^clear$/i).click();
  await expect(page.getByText(/^2 notes$/i)).toBeVisible();
});

test("removing a hashtag from a note's content removes it from that filter", async ({ page }) => {
  await registerAndEnterVault(page, "Tag Removal");
  await createNote(page, "Temp", "#temporary tag here");

  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await editor.pressSequentially("no tags anymore", { delay: 2 });
  await page.getByText("Saved").waitFor();

  await page.reload();
  await page.getByRole("button", { name: /\+ new note/i }).first().waitFor();
  await expect(page.getByText("#temporary", { exact: false })).not.toBeVisible();
});
