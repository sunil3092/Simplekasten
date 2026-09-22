import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

// Fixture: "Atomic Habits" has one photo and one voice note (see bridge.ts).
test.beforeEach(async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: /Atomic Habits/ }).first().click();
});

test("shows, adds and removes attachments", async ({ page }) => {
  const attachments = page.getByTestId("attachments");
  await expect(attachments.getByText("Attachments (2)")).toBeVisible();
  await expect(attachments.locator("img")).toHaveCount(1);
  await expect(attachments.locator("audio")).toHaveCount(1);

  // Opening a photo shows it full size.
  await attachments.locator("img").click();
  await expect(page.getByRole("dialog", { name: "whiteboard.svg" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Attach a photo or audio file" }).click();
  await expect(attachments.getByText("Attachments (3)")).toBeVisible();

  await attachments.getByRole("button", { name: "Remove attachment" }).first().click();
  await expect(attachments.getByText("Attachments (2)")).toBeVisible();
});

test("delete asks first, then removes the note", async ({ page }) => {
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("2 notes")).toBeVisible();

  await page.getByRole("button", { name: "Delete note" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this note?" });
  await expect(dialog).toContainText("Atomic Habits");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(sidebar.getByText("2 notes")).toBeVisible();

  await page.getByRole("button", { name: "Delete note" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(sidebar.getByText("1 note")).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /Atomic Habits/ })).toHaveCount(0);
  // The remaining note opens in its place.
  await expect(page.locator("input[placeholder='Untitled']")).toHaveValue("Systems");
});
