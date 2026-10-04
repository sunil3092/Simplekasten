import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

// Fixture starts with 2 ordinary notes, neither in the review queue (see bridge.ts).
test.beforeEach(async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
});

test("adding and removing the open note from the review queue updates the sidebar count", async ({ page }) => {
  const sidebar = page.locator("aside").first();
  const reviewButton = sidebar.getByRole("button", { name: "Review" });
  await expect(reviewButton.getByTestId("review-due-count")).toHaveCount(0);

  await page.getByRole("button", { name: "Add to review queue" }).click();
  await expect(reviewButton.getByTestId("review-due-count")).toHaveText("1");

  await page.getByRole("button", { name: "Remove from review queue" }).click();
  await expect(reviewButton.getByTestId("review-due-count")).toHaveCount(0);
});

test("a review session rates through the due queue and ends in the all-caught-up state", async ({ page }) => {
  await page.getByRole("button", { name: "Add to review queue" }).click();
  await page.getByRole("button", { name: /Systems/ }).first().click();
  await page.getByRole("button", { name: "Add to review queue" }).click();

  const sidebar = page.locator("aside").first();
  const reviewButton = sidebar.getByRole("button", { name: "Review" });
  await expect(reviewButton.getByTestId("review-due-count")).toHaveText("2");

  await reviewButton.click();
  const session = page.getByTestId("review-session");
  await expect(session.getByText("1 of 2")).toBeVisible();

  await session.getByRole("button", { name: "Good" }).click();
  await expect(session.getByText("2 of 2")).toBeVisible();

  await session.getByRole("button", { name: "Good" }).click();
  await expect(session.getByText("You're all caught up.")).toBeVisible();

  await session.getByRole("button", { name: "Close" }).first().click();
  await expect(reviewButton.getByTestId("review-due-count")).toHaveCount(0);
});

test("a new note is fleeting, so it lands in the review queue without being added by hand", async ({ page }) => {
  const sidebar = page.locator("aside").first();
  const reviewButton = sidebar.getByRole("button", { name: "Review" });
  await expect(reviewButton.getByTestId("review-due-count")).toHaveCount(0);

  await sidebar.getByRole("button", { name: "New note" }).click();
  await expect(reviewButton.getByTestId("review-due-count")).toHaveText("1");
  // The open note shows it is queued, and can be taken back out.
  await expect(page.getByRole("button", { name: "Remove from review queue" })).toBeVisible();

  // Notes made on the flow are queued too.
  await page.getByRole("button", { name: "Flow view" }).click();
  const flow = page.getByTestId("flow-view");
  await flow.getByRole("button", { name: "New note" }).click();
  await expect(page.getByTestId("flow-card")).toHaveCount(4);
  await flow.getByRole("button", { name: "Close" }).click();
  await expect(reviewButton.getByTestId("review-due-count")).toHaveText("2");

  await reviewButton.click();
  await expect(page.getByTestId("review-session").getByText("1 of 2")).toBeVisible();
});
