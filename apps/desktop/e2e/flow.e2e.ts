import { expect, test, type Locator } from "@playwright/test";
import { stubBridge } from "./bridge";

// Where one card sits relative to another — unaffected by the view re-centring
// itself when the flow is reopened.
const offset = async (card: Locator, anchor: Locator) => {
  const a = (await card.boundingBox())!;
  const b = (await anchor.boundingBox())!;
  return { x: Math.round(a.x - b.x), y: Math.round(a.y - b.y) };
};

// Fixture: "Systems" links to "Atomic Habits", so the flow has two cards and one arrow.
test("cards can be dragged, stay where they were put, and Auto-arrange resets them", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Flow view" }).click();

  const card = page.getByTestId("flow-card").first();
  const other = page.getByTestId("flow-card").last();
  const autoArrange = page.getByRole("button", { name: "Auto-arrange" });
  await expect(page.getByTestId("flow-edge")).toHaveCount(1);
  await expect(autoArrange).toBeDisabled();
  const start = await offset(card, other);
  const arrowBefore = await page.getByTestId("flow-edge").getAttribute("d");

  // Drag by the header strip.
  const handle = (await card.getByTestId("flow-card-handle").boundingBox())!;
  await page.mouse.move(handle.x + 40, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 240, handle.y + handle.height / 2 + 90, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => offset(card, other)).toEqual({ x: start.x + 200, y: start.y + 90 });
  // The arrow follows the card.
  expect(await page.getByTestId("flow-edge").getAttribute("d")).not.toBe(arrowBefore);

  // Closing and reopening keeps the arrangement.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Flow view" }).click();
  await expect.poll(() => offset(card, other)).toEqual({ x: start.x + 200, y: start.y + 90 });

  await autoArrange.click();
  await expect.poll(() => offset(card, other)).toEqual(start);
  await expect(autoArrange).toBeDisabled();
});
