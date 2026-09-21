import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

const cssVar = (name: string) => `getComputedStyle(document.documentElement).getPropertyValue("${name}").trim()`;

const MODES = [
  { mode: "light", bg: "#e8e6d9", ink: "#1f0f2e", line: "#1f0f2e", scheme: "light" },
  { mode: "dark", bg: "#1d0a2e", ink: "#e8e6d9", line: "#fad141", scheme: "dark" },
] as const;

for (const { mode, bg, ink, line, scheme } of MODES) {
  test(`memphis ${mode}: palette, chunky shape and hard teal shadow are applied`, async ({ page }) => {
    await stubBridge(page, { theme: "memphis", themeMode: mode });
    await page.goto("/");
    await page.getByRole("button", { name: /Atomic Habits/ }).first().click();
    await expect(page.getByText(/Linked mentions \(1\)/i)).toBeVisible();

    const root = page.locator("html");
    await expect.poll(() => page.evaluate(cssVar("--color-bg"))).toBe(bg);
    expect(await page.evaluate(cssVar("--color-ink"))).toBe(ink);
    expect(await page.evaluate(cssVar("--color-line"))).toBe(line);
    expect(await page.evaluate(cssVar("--color-accent"))).toBe("#f725a0");
    expect(await page.evaluate(cssVar("--border-w"))).toBe("3px");
    expect(await page.evaluate(cssVar("--shadow-md"))).toBe("4px 4px 0 #0cb2c0");
    await expect(root).toHaveAttribute("data-hard-shadow", "");
    expect(await root.evaluate((el) => el.style.colorScheme)).toBe(scheme);

    // The page really paints with the theme, not just the variables.
    const paintedBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = [bg.slice(1, 3), bg.slice(3, 5), bg.slice(5, 7)].map((h) => parseInt(h, 16));
    expect(paintedBg).toBe(`rgb(${r}, ${g}, ${b})`);

    await page.screenshot({ path: test.info().outputPath(`memphis-${mode}.png`) });
  });
}

test("memphis follows the system colour scheme when mode is 'system'", async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "system" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect.poll(() => page.evaluate(cssVar("--color-bg"))).toBe("#1d0a2e");

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => page.evaluate(cssVar("--color-bg"))).toBe("#e8e6d9");
});
