import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

// Fixture: "Systems" links to "Atomic Habits" via [[Atomic Habits]].
test("links show in both directions and navigate", async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
  const panel = page.locator("aside").last();

  // Source note: outgoing link is listed, nothing links to it.
  await page.getByRole("button", { name: /Systems/ }).first().click();
  await expect(panel.getByText(/^Links \(1\)/)).toBeVisible();
  await expect(panel.getByRole("button", { name: /Atomic Habits/ })).toBeVisible();
  await expect(panel.getByText(/Linked mentions \(0\)/i)).toBeVisible();

  // Target note: incoming backlink is listed, no outgoing links.
  await panel.getByRole("button", { name: /Atomic Habits/ }).click();
  await expect(panel.getByText(/Linked mentions \(1\)/i)).toBeVisible();
  await expect(panel.getByRole("button", { name: /Systems/ })).toBeVisible();
  await expect(panel.getByText(/^Links \(0\)/)).toBeVisible();

  // And the backlink navigates back.
  await panel.getByRole("button", { name: /Systems/ }).click();
  await expect(panel.getByText(/^Links \(1\)/)).toBeVisible();
});
