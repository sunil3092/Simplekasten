import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

test("sidebar sections collapse independently while Settings stays visible", async ({
  page,
}) => {
  await stubBridge(page, { theme: "memphis", themeMode: "system" });
  await page.goto("/");

  const groups = await page.locator("aside details").all();
  expect(groups.length).toBeGreaterThan(4);

  for (const group of groups) {
    await expect(group).toHaveJSProperty("open", true);
    await group.locator("summary").click();
    await expect(group).toHaveJSProperty("open", false);
  }

  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();

  const notes = groups.at(-1)!;
  await notes.locator("summary").click();
  await expect(notes).toHaveJSProperty("open", true);
});
