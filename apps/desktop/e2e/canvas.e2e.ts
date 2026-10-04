import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

test.beforeEach(async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
});

test("creating a canvas opens it, and it appears in the sidebar", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Project layout"));
  await page.getByRole("button", { name: "New canvas…" }).click();

  const canvas = page.getByTestId("canvas-view");
  await expect(canvas).toBeVisible();
  await expect(canvas.getByText("Project layout")).toBeVisible();

  await canvas.getByRole("button", { name: "Close" }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Project layout" })).toBeVisible();
});

test("adding a note card and a text card, then reopening the canvas keeps them", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Board"));
  await page.getByRole("button", { name: "New canvas…" }).click();
  const canvas = page.getByTestId("canvas-view");

  await canvas.getByRole("button", { name: "Note card" }).click();
  await page.getByRole("dialog", { name: "Quick switcher" }).getByText("Atomic Habits").click();
  await expect(canvas.getByTestId("canvas-card")).toHaveCount(1);
  await expect(canvas.getByText("Atomic Habits")).toBeVisible();

  await canvas.getByRole("button", { name: "Text card" }).click();
  await expect(canvas.getByTestId("canvas-card")).toHaveCount(2);
  await canvas.getByPlaceholder("Type a note…").fill("A scratch thought");
  await canvas.getByPlaceholder("Type a note…").blur();

  await canvas.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Board", exact: true }).click();

  const reopened = page.getByTestId("canvas-view");
  await expect(reopened.getByTestId("canvas-card")).toHaveCount(2);
  await expect(reopened.getByText("Atomic Habits")).toBeVisible();
  await expect(reopened.getByPlaceholder("Type a note…")).toHaveValue("A scratch thought");
});

test("clicking a note card opens that note and closes the canvas", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Board"));
  await page.getByRole("button", { name: "New canvas…" }).click();
  const canvas = page.getByTestId("canvas-view");

  await canvas.getByRole("button", { name: "Note card" }).click();
  await page.getByRole("dialog", { name: "Quick switcher" }).getByText("Systems").click();
  await canvas.getByText("Systems").click();

  await expect(page.getByTestId("canvas-view")).toHaveCount(0);
  const titleInput = page.locator("input[placeholder='Untitled']");
  await expect(titleInput).toHaveValue("Systems");
});

test("removing a card deletes it", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Board"));
  await page.getByRole("button", { name: "New canvas…" }).click();
  const canvas = page.getByTestId("canvas-view");

  await canvas.getByRole("button", { name: "Text card" }).click();
  await expect(canvas.getByTestId("canvas-card")).toHaveCount(1);

  await canvas.getByRole("button", { name: "Remove card" }).click();
  await expect(canvas.getByTestId("canvas-card")).toHaveCount(0);
});
