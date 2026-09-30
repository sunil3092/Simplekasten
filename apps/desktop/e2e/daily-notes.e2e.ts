import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

// Fixture starts with 2 ordinary notes, no daily notes (see bridge.ts).
test.beforeEach(async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
});

test("Today opens today's note, creating it once and reusing it on a second click", async ({ page }) => {
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("2 notes")).toBeVisible();

  await page.getByRole("button", { name: "Today" }).click();
  await expect(sidebar.getByText("3 notes")).toBeVisible();
  const titleInput = page.locator("input[placeholder='Untitled']");
  await expect(titleInput).not.toHaveValue("");
  const firstTitle = await titleInput.inputValue();

  // Navigate away, then click Today again — no duplicate note is created,
  // and the same daily note reopens.
  await sidebar.getByRole("button", { name: /Atomic Habits/ }).click();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(sidebar.getByText("3 notes")).toBeVisible();
  await expect(titleInput).toHaveValue(firstTitle);
});

test("Next day creates a new note, and the Journal section lists it", async ({ page }) => {
  await page.getByRole("button", { name: "Today" }).click();

  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("Journal")).toBeVisible();
  await expect(sidebar.getByText("3 notes")).toBeVisible();
  await expect(page.getByTestId("journal-list").locator("button")).toHaveCount(1);

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(sidebar.getByText("4 notes")).toBeVisible();
  await expect(page.getByTestId("journal-list").locator("button")).toHaveCount(2);
});

test("Previous day from a daily note goes back a day without creating duplicates", async ({ page }) => {
  await page.getByRole("button", { name: "Today" }).click();
  const titleInput = page.locator("input[placeholder='Untitled']");
  const todayTitle = await titleInput.inputValue();

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(titleInput).not.toHaveValue(todayTitle);

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(titleInput).toHaveValue(todayTitle);

  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("4 notes")).toBeVisible(); // 2 fixture + 2 daily, no duplicates from the round trip
});
