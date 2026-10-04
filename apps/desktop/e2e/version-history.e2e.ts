import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

// "Atomic Habits" starts with one earlier version (see bridge.ts) whose
// content included a line ("Start tiny.") the current note no longer has.
test.beforeEach(async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
});

test("opening version history shows the earlier version and a diff against the current content", async ({ page }) => {
  await page.getByRole("button", { name: "Version history" }).click();
  const modal = page.getByRole("dialog", { name: "Version history" });

  await expect(modal).toBeVisible();
  await expect(modal.getByText("Start tiny.")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Restore this version" })).toBeVisible();
});

test("restoring a version replaces the note's content and snapshots the prior state", async ({ page }) => {
  await page.getByRole("button", { name: "Version history" }).click();
  const modal = page.getByRole("dialog", { name: "Version history" });
  await modal.getByRole("button", { name: "Restore this version" }).click();
  await modal.getByRole("button", { name: "Restore", exact: true }).click();

  await expect(modal).toHaveCount(0);
  await expect(page.locator(".cm-content")).toContainText("Start tiny.");

  // Restoring snapshots the pre-restore state, so history now has 2 entries.
  await page.getByRole("button", { name: "Version history" }).click();
  const reopened = page.getByRole("dialog", { name: "Version history" });
  await expect(reopened.locator("ul > li")).toHaveCount(2);
});
